"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store/useAppStore";
import type {
  AppState,
  Category,
  Profile,
  Report,
  ReportStatus,
  UserWarning,
} from "@/lib/types";
import { CATEGORIES } from "@/lib/constants";
import { requireUser, ServiceError } from "@/lib/services/shared";
import { rowToProfile } from "@/lib/services/authService";
import { rowToPost } from "@/lib/services/postService";
import { rowToReport } from "@/lib/services/reportService";
import { rowToRequest } from "@/lib/services/requestService";
import { fetchVerificationRequests } from "@/lib/services/verificationService";
import { pushNotification } from "@/lib/services/notificationService";
import { createUuid } from "@/lib/utils";

export interface PlatformMetrics {
  totalUsers: number;
  olderUsers: number;
  youngerUsers: number;
  activeTotal: number;
  activeOlder: number;
  activeYounger: number;
  inactiveTotal: number;
  verifiedUsers: number;
  pendingVerifications: number;
  bannedUsers: number;
  warnedUsers: number;
  totalPosts: number;
  openPosts: number;
  inProgressPosts: number;
  completedPosts: number;
  closedPosts: number;
  postsByCategory: Array<{ category: Category; count: number }>;
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  fakeReportsDismissed: number;
  totalRequests: number;
  totalActivities: number;
  totalReviews: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Determines whether a user is considered active (not banned, and active within 30d or has platform activity).
 */
export function isUserActive(user: Profile, state: Pick<AppState, "posts" | "requests" | "messages" | "activities">, nowMs = Date.now()): boolean {
  if (user.isBanned) return false;

  if (user.lastActiveAt) {
    const activeAt = new Date(user.lastActiveAt).getTime();
    if (!Number.isNaN(activeAt) && nowMs - activeAt <= THIRTY_DAYS_MS) {
      return true;
    }
  }

  const hasPost = state.posts.some((p) => p.authorId === user.id);
  const hasRequest = state.requests.some((r) => r.requesterId === user.id || r.ownerId === user.id);
  const hasMessage = state.messages.some((m) => m.senderId === user.id);
  const hasActivity = state.activities.some((a) => a.participantIds.includes(user.id));

  return hasPost || hasRequest || hasMessage || hasActivity;
}

/**
 * Computes all monitoring KPIs and chart breakdowns from current application state.
 */
export function computePlatformMetrics(state: AppState, nowMs = Date.now()): PlatformMetrics {
  const users = state.users;
  const olderUsersList = users.filter((u) => u.userGroup === "og");
  const youngerUsersList = users.filter((u) => u.userGroup === "yg");

  const activeOlder = olderUsersList.filter((u) => isUserActive(u, state, nowMs)).length;
  const activeYounger = youngerUsersList.filter((u) => isUserActive(u, state, nowMs)).length;
  const activeTotal = activeOlder + activeYounger;

  const reports = state.reports;
  const pendingReports = reports.filter((r) => !r.status || r.status === "pending").length;
  const fakeReportsDismissed = reports.filter((r) => r.status === "dismissed_fake").length;
  const resolvedReports = reports.length - pendingReports;

  const verifications = state.verificationRequests ?? [];
  const pendingVerifications = verifications.filter((v) => v.status === "pending").length;

  const postsByCategory = CATEGORIES.map((category) => ({
    category,
    count: state.posts.filter((p) => p.category === category).length,
  }));

  return {
    totalUsers: users.length,
    olderUsers: olderUsersList.length,
    youngerUsers: youngerUsersList.length,
    activeTotal,
    activeOlder,
    activeYounger,
    inactiveTotal: Math.max(0, users.length - activeTotal),
    verifiedUsers: users.filter((u) => u.verificationStatus === "verified").length,
    pendingVerifications,
    bannedUsers: users.filter((u) => Boolean(u.isBanned)).length,
    warnedUsers: users.filter((u) => (u.warningsCount ?? 0) > 0).length,
    totalPosts: state.posts.length,
    openPosts: state.posts.filter((p) => p.status === "open").length,
    inProgressPosts: state.posts.filter((p) => p.status === "in_progress").length,
    completedPosts: state.posts.filter((p) => p.status === "completed").length,
    closedPosts: state.posts.filter((p) => p.status === "closed").length,
    postsByCategory,
    totalReports: reports.length,
    pendingReports,
    resolvedReports,
    fakeReportsDismissed,
    totalRequests: state.requests.length,
    totalActivities: state.activities.length,
    totalReviews: state.reviews.length,
  };
}

/**
 * Checks whether a profile has admin privileges.
 */
export function isAdminProfile(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(profile.isAdmin);
}

/**
 * Grants admin mode in local store for hackathon evaluation/testing when DB flag isn't set yet,
 * and persists to Supabase if allowed by RLS.
 */
export async function enableAdminAccessForCurrentUser(): Promise<void> {
  const me = requireUser();
  const supabase = createClient();

  await supabase
    .from("profiles")
    .update({ is_admin: true, updated_at: new Date().toISOString() })
    .eq("id", me.id);

  useAppStore.setState((state) => ({
    users: state.users.map((u) => (u.id === me.id ? { ...u, isAdmin: true } : u)),
  }));
}

/**
 * Fetches all monitoring, report, warning, and verification data for the Admin Panel.
 */
export async function fetchAdminDashboardData(): Promise<void> {
  const supabase = createClient();

  const [profilesRes, postsRes, reportsRes, requestsRes, warningsRes] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("posts").select("*").order("created_at", { ascending: false }),
    supabase.from("reports").select("*").order("created_at", { ascending: false }),
    supabase.from("service_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("user_warnings").select("*").order("created_at", { ascending: false }),
  ]);

  await fetchVerificationRequests();

  useAppStore.setState((state) => {
    const nextUsers =
      profilesRes.data && profilesRes.data.length > 0
        ? mergeById(profilesRes.data.map(rowToProfile), state.users)
        : state.users;

    const nextPosts =
      postsRes.data && postsRes.data.length > 0
        ? mergeById(postsRes.data.map(rowToPost), state.posts)
        : state.posts;

    const nextReports =
      reportsRes.data && reportsRes.data.length > 0
        ? mergeById(reportsRes.data.map(rowToReport), state.reports)
        : state.reports;

    const nextRequests =
      requestsRes.data && requestsRes.data.length > 0
        ? mergeById(requestsRes.data.map(rowToRequest), state.requests)
        : state.requests;

    const nextWarnings: UserWarning[] =
      warningsRes.data && warningsRes.data.length > 0
        ? mergeById(
            warningsRes.data.map((w: any): UserWarning => ({
              id: w.id,
              userId: w.user_id,
              issuedBy: w.issued_by,
              reason: w.reason,
              reportId: w.report_id ?? null,
              createdAt: w.created_at ?? new Date().toISOString(),
            })),
            state.warnings ?? [],
          )
        : state.warnings ?? [];

    return {
      users: nextUsers,
      posts: nextPosts,
      reports: nextReports,
      requests: nextRequests,
      warnings: nextWarnings,
    };
  });
}

function mergeById<T extends { id: string }>(remote: T[], local: T[]): T[] {
  const remoteIds = new Set(remote.map((item) => item.id));
  return [...remote, ...local.filter((item) => !remoteIds.has(item.id))];
}

/**
 * Updates a report's resolution status in Supabase and local store.
 */
async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  resolutionNote: string,
  adminId: string,
) {
  const now = new Date().toISOString();
  const supabase = createClient();

  await supabase
    .from("reports")
    .update({
      status,
      resolution_note: resolutionNote,
      resolved_by: adminId,
      resolved_at: now,
    })
    .eq("id", reportId);

  useAppStore.setState((state) => ({
    reports: state.reports.map((r) =>
      r.id === reportId
        ? { ...r, status, resolutionNote, resolvedBy: adminId, resolvedAt: now }
        : r,
    ),
  }));
}

/**
 * Deletes a suspicious/reported post and resolves any linked report.
 */
export async function deletePostAsAdmin(postId: string, reportId?: string, note?: string): Promise<void> {
  const admin = requireUser();
  const supabase = createClient();

  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) {
    console.warn("Admin post delete Supabase warning:", error.message);
  }

  const state = useAppStore.getState();
  const deletedPost = state.posts.find((p) => p.id === postId);

  useAppStore.setState((current) => ({
    posts: current.posts.filter((p) => p.id !== postId),
    requests: current.requests.filter((r) => r.postId !== postId),
  }));

  if (deletedPost) {
    pushNotification({
      userId: deletedPost.authorId,
      type: "warning",
      title: "Post Removed by Moderator",
      body: `Your post "${deletedPost.title}" was removed because it violated community guidelines.${note ? ` Note: ${note}` : ""}`,
      href: "/posts",
    });
  }

  if (reportId) {
    await updateReportStatus(
      reportId,
      "resolved_deleted",
      note?.trim() || "Post deleted by admin.",
      admin.id,
    );
  }
}

/**
 * Issues a formal warning to a user (either a suspicious post owner or a fake reporter).
 */
export async function warnUserAsAdmin(
  userId: string,
  reason: string,
  reportId?: string,
  reportStatus: ReportStatus = "resolved_warned",
): Promise<UserWarning> {
  const admin = requireUser();
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new ServiceError("Please enter a warning reason.");
  }

  const now = new Date().toISOString();
  const warning: UserWarning = {
    id: createUuid(),
    userId,
    issuedBy: admin.id,
    reason: trimmedReason,
    reportId: reportId ?? null,
    createdAt: now,
  };

  const state = useAppStore.getState();
  const targetUser = state.users.find((u) => u.id === userId);
  const nextCount = (targetUser?.warningsCount ?? 0) + 1;

  const supabase = createClient();
  await supabase.from("user_warnings").insert({
    id: warning.id,
    user_id: userId,
    issued_by: admin.id,
    reason: trimmedReason,
    report_id: reportId ?? null,
    created_at: now,
  });

  await supabase
    .from("profiles")
    .update({ warnings_count: nextCount, updated_at: now })
    .eq("id", userId);

  useAppStore.setState((current) => ({
    warnings: [warning, ...(current.warnings ?? [])],
    users: current.users.map((u) =>
      u.id === userId ? { ...u, warningsCount: nextCount } : u,
    ),
  }));

  pushNotification({
    userId,
    type: "warning",
    title: "Community Safety Warning",
    body: `You received a warning from an administrator: ${trimmedReason}`,
    href: `/profile/${userId}`,
  });

  if (reportId) {
    await updateReportStatus(reportId, reportStatus, `Warning issued: ${trimmedReason}`, admin.id);
  }

  return warning;
}

/**
 * Bans a user (either post owner or fake reporter) from the platform.
 */
export async function banUserAsAdmin(
  userId: string,
  reason: string,
  reportId?: string,
  reportStatus: ReportStatus = "resolved_banned",
): Promise<void> {
  const admin = requireUser();
  if (userId === admin.id) {
    throw new ServiceError("You cannot ban your own admin account.");
  }

  const trimmedReason = reason.trim() || "Violation of community safety guidelines.";
  const now = new Date().toISOString();
  const supabase = createClient();

  await supabase
    .from("profiles")
    .update({
      is_banned: true,
      ban_reason: trimmedReason,
      updated_at: now,
    })
    .eq("id", userId);

  useAppStore.setState((current) => ({
    users: current.users.map((u) =>
      u.id === userId ? { ...u, isBanned: true, banReason: trimmedReason } : u,
    ),
  }));

  pushNotification({
    userId,
    type: "warning",
    title: "Account Suspended",
    body: `Your account has been suspended by an administrator. Reason: ${trimmedReason}`,
    href: `/profile/${userId}`,
  });

  if (reportId) {
    await updateReportStatus(reportId, reportStatus, `User banned: ${trimmedReason}`, admin.id);
  }
}

/**
 * Unbans a previously banned user.
 */
export async function unbanUserAsAdmin(userId: string): Promise<void> {
  requireUser();
  const now = new Date().toISOString();
  const supabase = createClient();

  await supabase
    .from("profiles")
    .update({
      is_banned: false,
      ban_reason: null,
      updated_at: now,
    })
    .eq("id", userId);

  useAppStore.setState((current) => ({
    users: current.users.map((u) =>
      u.id === userId ? { ...u, isBanned: false, banReason: null } : u,
    ),
  }));
}

/**
 * Marks a report as a false/fake report without banning yet, or with optional note.
 */
export async function dismissFakeReport(reportId: string, note?: string): Promise<void> {
  const admin = requireUser();
  await updateReportStatus(
    reportId,
    "dismissed_fake",
    note?.trim() || "Reviewed and dismissed as invalid / fake report.",
    admin.id,
  );
}

/**
 * React hook for the Admin Dashboard to compute live metrics and load remote records.
 */
export function useAdminDashboard() {
  const users = useAppStore((s) => s.users);
  const posts = useAppStore((s) => s.posts);
  const requests = useAppStore((s) => s.requests);
  const messages = useAppStore((s) => s.messages);
  const activities = useAppStore((s) => s.activities);
  const reviews = useAppStore((s) => s.reviews);
  const reports = useAppStore((s) => s.reports);
  const verificationRequests = useAppStore((s) => s.verificationRequests ?? []);
  const warnings = useAppStore((s) => s.warnings ?? []);

  useEffect(() => {
    fetchAdminDashboardData();
  }, []);

  const metrics = useMemo(() => {
    const state = useAppStore.getState();
    return computePlatformMetrics(state);
  }, [users, posts, requests, messages, activities, reviews, reports, verificationRequests, warnings]);

  return {
    metrics,
    users,
    posts,
    reports,
    verificationRequests,
    warnings,
    refresh: fetchAdminDashboardData,
  };
}
