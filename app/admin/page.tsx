"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  Activity,
  UserCheck,
  UserX,
  Flag,
  Trash2,
  AlertTriangle,
  Ban,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  Search,
  BarChart3,
  FileCheck2,
  ExternalLink,
  Clock,
  Sparkles,
} from "lucide-react";
import { AuthGuard } from "@/components/common/AuthGuard";
import { useSession } from "@/lib/services/authService";
import {
  useAdminDashboard,
  isAdminProfile,
  isUserActive,
  enableAdminAccessForCurrentUser,
  deletePostAsAdmin,
  warnUserAsAdmin,
  banUserAsAdmin,
  unbanUserAsAdmin,
  dismissFakeReport,
} from "@/lib/services/adminService";
import {
  approveVerification,
  rejectVerification,
} from "@/lib/services/verificationService";
import { useAppStore } from "@/lib/store/useAppStore";
import { AdminCharts } from "@/components/admin/AdminCharts";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { formatWhen, initials } from "@/lib/utils";
import type { Profile, Report, VerificationRequest } from "@/lib/types";

type AdminTab = "overview" | "reports" | "verifications" | "users";
type ReportFilter = "pending" | "all" | "resolved";
type VerificationFilter = "pending" | "approved" | "rejected" | "all";
type UserFilter = "all" | "og" | "yg" | "active" | "verified" | "warned" | "banned";

interface ModerationModalState {
  kind: "warn" | "ban" | "reject_verification";
  targetId: string;
  targetName: string;
  reportId?: string;
  reportStatus?: "resolved_warned" | "resolved_banned" | "dismissed_fake";
  title: string;
  placeholder: string;
}

export default function AdminDashboardPage() {
  const session = useSession();
  const { metrics, users, posts, reports, verificationRequests, warnings, refresh } =
    useAdminDashboard();
  const appState = useAppStore.getState();

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [reportFilter, setReportFilter] = useState<ReportFilter>("pending");
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("pending");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [userSearch, setUserSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Document preview modal
  const [previewDoc, setPreviewDoc] = useState<VerificationRequest | null>(null);

  // Moderation reason modal
  const [modModal, setModModal] = useState<ModerationModalState | null>(null);
  const [modReason, setModReason] = useState("");

  const isAdmin = isAdminProfile(session);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleEnableDemoAdmin = async () => {
    setBusyId("enable-admin");
    try {
      await enableAdminAccessForCurrentUser();
      setStatusBanner({ type: "ok", text: "Admin access enabled for your account." });
    } catch (err: any) {
      setStatusBanner({ type: "err", text: err?.message || "Failed to enable admin mode." });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteReportedPost = async (postId: string, reportId?: string) => {
    if (!confirm("Permanently delete this post and notify the author?")) return;
    setBusyId(reportId || postId);
    setStatusBanner(null);
    try {
      await deletePostAsAdmin(postId, reportId, "Removed by admin moderation");
      setStatusBanner({ type: "ok", text: "Post deleted and report resolved." });
    } catch (err: any) {
      setStatusBanner({ type: "err", text: err?.message || "Failed to delete post." });
    } finally {
      setBusyId(null);
    }
  };

  const handleDismissFake = async (reportId: string) => {
    setBusyId(reportId);
    setStatusBanner(null);
    try {
      await dismissFakeReport(reportId);
      setStatusBanner({ type: "ok", text: "Report marked as fake / dismissed." });
    } catch (err: any) {
      setStatusBanner({ type: "err", text: err?.message || "Failed to dismiss report." });
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveVerification = async (verificationId: string) => {
    setBusyId(verificationId);
    setStatusBanner(null);
    try {
      await approveVerification(verificationId);
      setStatusBanner({ type: "ok", text: "Profile verified! User now has the Verified badge." });
    } catch (err: any) {
      setStatusBanner({ type: "err", text: err?.message || "Failed to approve verification." });
    } finally {
      setBusyId(null);
    }
  };

  const handleUnban = async (userId: string) => {
    setBusyId(userId);
    setStatusBanner(null);
    try {
      await unbanUserAsAdmin(userId);
      setStatusBanner({ type: "ok", text: "User suspension lifted." });
    } catch (err: any) {
      setStatusBanner({ type: "err", text: err?.message || "Failed to unban user." });
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitModModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modModal) return;
    const reason = modReason.trim();
    if (!reason) return;

    setBusyId(modModal.targetId);
    setStatusBanner(null);
    try {
      if (modModal.kind === "warn") {
        await warnUserAsAdmin(
          modModal.targetId,
          reason,
          modModal.reportId,
          modModal.reportStatus ?? "resolved_warned",
        );
        setStatusBanner({ type: "ok", text: `Warning issued to ${modModal.targetName}.` });
      } else if (modModal.kind === "ban") {
        await banUserAsAdmin(
          modModal.targetId,
          reason,
          modModal.reportId,
          modModal.reportStatus ?? "resolved_banned",
        );
        setStatusBanner({ type: "ok", text: `${modModal.targetName} has been banned.` });
      } else if (modModal.kind === "reject_verification") {
        await rejectVerification(modModal.targetId, reason);
        setStatusBanner({ type: "ok", text: `Verification rejected for ${modModal.targetName}.` });
      }
      setModModal(null);
      setModReason("");
    } catch (err: any) {
      setStatusBanner({ type: "err", text: err?.message || "Moderation action failed." });
    } finally {
      setBusyId(null);
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const status = r.status ?? "pending";
      if (reportFilter === "pending") return status === "pending";
      if (reportFilter === "resolved") return status !== "pending";
      return true;
    });
  }, [reports, reportFilter]);

  const filteredVerifications = useMemo(() => {
    return verificationRequests.filter((v) => {
      if (verificationFilter === "all") return true;
      return v.status === verificationFilter;
    });
  }, [verificationRequests, verificationFilter]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const hit =
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.location || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (userFilter === "og") return u.userGroup === "og";
      if (userFilter === "yg") return u.userGroup === "yg";
      if (userFilter === "active") return isUserActive(u, appState);
      if (userFilter === "verified") return u.verificationStatus === "verified";
      if (userFilter === "warned") return (u.warningsCount ?? 0) > 0;
      if (userFilter === "banned") return Boolean(u.isBanned);
      return true;
    });
  }, [users, userSearch, userFilter, appState]);

  const userById = (id: string): Profile | undefined => users.find((u) => u.id === id);

  return (
    <AuthGuard>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {!isAdmin ? (
          <div className="mx-auto max-w-xl rounded-3xl border-2 border-border bg-card p-8 text-center space-y-5 shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-foreground">Admin Access Required</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This monitoring &amp; moderation console is restricted to platform administrators (`is_admin = true` in Supabase profiles).
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                onClick={handleEnableDemoAdmin}
                disabled={busyId === "enable-admin"}
                className="font-bold gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {busyId === "enable-admin" ? "Activating..." : "Activate Admin Mode"}
                </span>
              </Button>
              <Button asChild variant="outline">
                <Link href="/posts">Back to Community</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Top Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Musubi Admin Console</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                  Platform Monitoring &amp; Safety Control
                </h1>
                <p className="text-sm text-muted-foreground">
                  Monitor community demographics, moderate reported posts, verify user documents, and manage safety.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="gap-1.5 font-bold"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  <span>{refreshing ? "Syncing..." : "Refresh Data"}</span>
                </Button>
              </div>
            </div>

            {statusBanner && (
              <div
                role="status"
                className={`rounded-xl border p-3.5 text-sm font-semibold flex items-center justify-between gap-3 ${
                  statusBanner.type === "ok"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}
              >
                <span className="flex items-center gap-2">
                  {statusBanner.type === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  )}
                  {statusBanner.text}
                </span>
                <button
                  type="button"
                  onClick={() => setStatusBanner(null)}
                  className="text-xs underline opacity-80 hover:opacity-100"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {(
                [
                  { id: "overview", label: "Overview & Analytics", icon: BarChart3 },
                  {
                    id: "reports",
                    label: "Post Reports",
                    icon: Flag,
                    badge: metrics.pendingReports,
                  },
                  {
                    id: "verifications",
                    label: "Profile Verifications",
                    icon: FileCheck2,
                    badge: metrics.pendingVerifications,
                  },
                  {
                    id: "users",
                    label: "User Management",
                    icon: Users,
                    badge: metrics.bannedUsers > 0 ? metrics.bannedUsers : undefined,
                  },
                ] as Array<{ id: AdminTab; label: string; icon: typeof BarChart3; badge?: number }>
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 border-2 ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-card text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {tab.badge ? (
                      <span
                        className={`ml-1 px-2 py-0.5 rounded-full text-xs font-extrabold tabular-nums ${
                          active
                            ? "bg-white/20 text-white"
                            : "bg-destructive text-destructive-foreground"
                        }`}
                      >
                        {tab.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* ==================== TAB 1: OVERVIEW & ANALYTICS ==================== */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Primary User & Activity KPI Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <KpiCard
                    title="Total Users"
                    value={metrics.totalUsers}
                    subtitle={`${metrics.verifiedUsers} verified · ${metrics.bannedUsers} banned`}
                    icon={Users}
                    accent="bg-primary/10 text-primary"
                  />
                  <KpiCard
                    title="Older Users (60+)"
                    value={metrics.olderUsers}
                    subtitle={`${metrics.activeOlder} active in older category`}
                    icon={Users}
                    accent="bg-[#B4441A]/15 text-[#B4441A]"
                  />
                  <KpiCard
                    title="Younger Users (<60)"
                    value={metrics.youngerUsers}
                    subtitle={`${metrics.activeYounger} active in younger category`}
                    icon={Users}
                    accent="bg-[#3F7356]/15 text-[#3F7356]"
                  />
                  <KpiCard
                    title="Active Users (Total)"
                    value={metrics.activeTotal}
                    subtitle={`Active Older: ${metrics.activeOlder} · Active Younger: ${metrics.activeYounger}`}
                    icon={Activity}
                    accent="bg-emerald-100 text-emerald-700"
                  />
                  <KpiCard
                    title="Post Reports Queue"
                    value={metrics.pendingReports}
                    subtitle={`${metrics.totalReports} total · ${metrics.fakeReportsDismissed} fake dismissed`}
                    icon={Flag}
                    accent="bg-amber-100 text-amber-700"
                  />
                  <KpiCard
                    title="Pending Verifications"
                    value={metrics.pendingVerifications}
                    subtitle={`${metrics.totalPosts} posts · ${metrics.totalActivities} completed exchanges`}
                    icon={UserCheck}
                    accent="bg-blue-100 text-blue-700"
                  />
                </div>

                {/* Secondary Platform Activity Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MiniStat label="Total Posts" value={metrics.totalPosts} />
                  <MiniStat label="Service Requests" value={metrics.totalRequests} />
                  <MiniStat label="Completed Exchanges" value={metrics.totalActivities} />
                  <MiniStat label="Warned Users" value={metrics.warnedUsers} />
                </div>

                {/* Charts */}
                <AdminCharts metrics={metrics} />
              </div>
            )}

            {/* ==================== TAB 2: POST REPORTS & MODERATION ==================== */}
            {activeTab === "reports" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {(["pending", "all", "resolved"] as ReportFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setReportFilter(f)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize border transition-colors ${
                          reportFilter === f
                            ? "bg-foreground text-background border-foreground"
                            : "bg-card text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Showing {filteredReports.length} report(s)
                  </span>
                </div>

                {filteredReports.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center space-y-2">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                    <h3 className="text-lg font-bold text-foreground">No reports in this view</h3>
                    <p className="text-sm text-muted-foreground">
                      When community members report a post or profile, it will appear here with full context and moderation tools.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredReports.map((report) => {
                      const reportedPost =
                        report.targetType === "post"
                          ? posts.find((p) => p.id === report.targetId)
                          : undefined;
                      const postOwner = reportedPost
                        ? userById(reportedPost.authorId)
                        : report.targetType === "user"
                        ? userById(report.targetId)
                        : undefined;
                      const reporter = userById(report.reporterId);
                      const status = report.status ?? "pending";
                      const isPending = status === "pending";

                      return (
                        <div
                          key={report.id}
                          className="rounded-2xl border-2 border-border bg-card p-5 space-y-4 shadow-sm"
                        >
                          {/* Report Header */}
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <ReportStatusBadge status={status} />
                                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                  {report.targetType === "post" ? "Post Report" : "User Report"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Reported {formatWhen(report.createdAt)}
                                </span>
                              </div>
                              <p className="text-base font-extrabold text-foreground">
                                Reason: {report.reason}
                              </p>
                              {report.resolutionNote && (
                                <p className="text-xs font-medium text-muted-foreground">
                                  Resolution: {report.resolutionNote}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* 3-Column Context: Reported Post + Post Owner Profile + Reporting User Profile */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* 1. Reported Post / Target Content */}
                            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                {report.targetType === "post" ? "Reported Post" : "Reported Account"}
                              </p>
                              {reportedPost ? (
                                <>
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-bold text-sm text-foreground">
                                      {reportedPost.title}
                                    </h4>
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                                      {reportedPost.category}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-3">
                                    {reportedPost.description}
                                  </p>
                                  <Link
                                    href={`/posts/${reportedPost.id}`}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline pt-1"
                                  >
                                    <span>View full post</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">
                                  {report.targetType === "post"
                                    ? "This post has already been deleted."
                                    : `Target user ID: ${report.targetId}`}
                                </p>
                              )}
                            </div>

                            {/* 2. Post Owner / Reported User Profile */}
                            <ProfileSnapshotCard
                              label={report.targetType === "post" ? "Post Owner Profile" : "Reported User Profile"}
                              user={postOwner}
                              fallbackId={reportedPost?.authorId || report.targetId}
                            />

                            {/* 3. Reporting User Profile */}
                            <ProfileSnapshotCard
                              label="Reporting User Profile"
                              user={reporter}
                              fallbackId={report.reporterId}
                            />
                          </div>

                          {/* Moderation Action Controls */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border">
                            {/* Actions against suspicious Post / Owner */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-muted-foreground mr-1">
                                If suspicious:
                              </span>
                              {reportedPost && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={busyId === report.id}
                                  onClick={() => handleDeleteReportedPost(reportedPost.id, report.id)}
                                  className="gap-1.5 text-xs font-bold"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete Post
                                </Button>
                              )}
                              {postOwner && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busyId === postOwner.id}
                                    onClick={() => {
                                      setModReason("");
                                      setModModal({
                                        kind: "warn",
                                        targetId: postOwner.id,
                                        targetName: postOwner.fullName,
                                        reportId: report.id,
                                        reportStatus: "resolved_warned",
                                        title: `Warn Post Owner (${postOwner.fullName})`,
                                        placeholder: "Describe why this post/behavior violates community rules...",
                                      });
                                    }}
                                    className="gap-1.5 text-xs font-bold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Warn Owner
                                  </Button>
                                  {!postOwner.isBanned && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={busyId === postOwner.id}
                                      onClick={() => {
                                        setModReason("");
                                        setModModal({
                                          kind: "ban",
                                          targetId: postOwner.id,
                                          targetName: postOwner.fullName,
                                          reportId: report.id,
                                          reportStatus: "resolved_banned",
                                          title: `Ban Post Owner (${postOwner.fullName})`,
                                          placeholder: "Reason for suspending this user's account...",
                                        });
                                      }}
                                      className="gap-1.5 text-xs font-bold border-rose-300 text-rose-800 bg-rose-50 hover:bg-rose-100"
                                    >
                                      <Ban className="h-3.5 w-3.5" />
                                      Ban Owner
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Actions against Fake / Malicious Report */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-muted-foreground mr-1">
                                If fake report:
                              </span>
                              {isPending && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busyId === report.id}
                                  onClick={() => handleDismissFake(report.id)}
                                  className="gap-1 text-xs font-bold"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Dismiss Fake
                                </Button>
                              )}
                              {reporter && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busyId === reporter.id}
                                    onClick={() => {
                                      setModReason("");
                                      setModModal({
                                        kind: "warn",
                                        targetId: reporter.id,
                                        targetName: reporter.fullName,
                                        reportId: report.id,
                                        reportStatus: "dismissed_fake",
                                        title: `Warn Fake Reporter (${reporter.fullName})`,
                                        placeholder: "Explain that submitting false/malicious reports violates guidelines...",
                                      });
                                    }}
                                    className="gap-1.5 text-xs font-bold border-amber-300 text-amber-900"
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Warn Reporter
                                  </Button>
                                  {!reporter.isBanned && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={busyId === reporter.id}
                                      onClick={() => {
                                        setModReason("");
                                        setModModal({
                                          kind: "ban",
                                          targetId: reporter.id,
                                          targetName: reporter.fullName,
                                          reportId: report.id,
                                          reportStatus: "dismissed_fake",
                                          title: `Ban Fake Reporter (${reporter.fullName})`,
                                          placeholder: "Reason for banning reporter for repeated/malicious fake reports...",
                                        });
                                      }}
                                      className="gap-1.5 text-xs font-bold border-rose-300 text-rose-800"
                                    >
                                      <Ban className="h-3.5 w-3.5" />
                                      Ban Reporter
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ==================== TAB 3: PROFILE VERIFICATIONS ==================== */}
            {activeTab === "verifications" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {(["pending", "approved", "rejected", "all"] as VerificationFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setVerificationFilter(f)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize border transition-colors ${
                          verificationFilter === f
                            ? "bg-foreground text-background border-foreground"
                            : "bg-card text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Showing {filteredVerifications.length} submission(s)
                  </span>
                </div>

                {filteredVerifications.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center space-y-2">
                    <ShieldCheck className="h-10 w-10 text-emerald-600 mx-auto" />
                    <h3 className="text-lg font-bold text-foreground">No verification requests here</h3>
                    <p className="text-sm text-muted-foreground">
                      Members can upload ID documents from their Edit Profile page. Submissions will appear here for your approval.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredVerifications.map((ver) => {
                      const applicant = userById(ver.userId);
                      return (
                        <div
                          key={ver.id}
                          className="rounded-2xl border-2 border-border bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-11 w-11 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                                  {applicant?.avatarUrl ? (
                                    <img
                                      src={applicant.avatarUrl}
                                      alt={applicant.fullName}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    initials(applicant?.fullName || "User")
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <Link
                                      href={`/profile/${ver.userId}`}
                                      className="font-bold text-foreground hover:text-primary truncate"
                                    >
                                      {applicant?.fullName || ver.userId}
                                    </Link>
                                    <VerifiedBadge status={applicant?.verificationStatus} compact />
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {applicant?.email || "Member"} ·{" "}
                                    {applicant?.userGroup === "og" ? "Older (60+)" : "Younger (<60)"}
                                  </p>
                                </div>
                              </div>

                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize shrink-0 ${
                                  ver.status === "approved"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : ver.status === "rejected"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {ver.status}
                              </span>
                            </div>

                            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-foreground uppercase">
                                  {ver.documentType.replace("_", " ")}
                                </span>
                                <span className="text-muted-foreground">
                                  {formatWhen(ver.createdAt)}
                                </span>
                              </div>

                              {ver.documentUrl.startsWith("data:image/") ||
                              ver.documentUrl.startsWith("http") ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc(ver)}
                                  className="group relative w-full h-40 rounded-lg overflow-hidden border border-border bg-background block"
                                >
                                  <img
                                    src={ver.documentUrl}
                                    alt={ver.documentName}
                                    className="h-full w-full object-contain"
                                  />
                                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                                    <Eye className="h-4 w-4" />
                                    Inspect Document
                                  </span>
                                </button>
                              ) : (
                                <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                                  <span className="text-xs font-semibold truncate">{ver.documentName}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setPreviewDoc(ver)}
                                    className="text-xs gap-1"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Open
                                  </Button>
                                </div>
                              )}

                              {ver.notes && (
                                <p className="text-xs text-muted-foreground">
                                  <strong>User note:</strong> {ver.notes}
                                </p>
                              )}
                              {ver.adminNotes && (
                                <p className="text-xs text-primary font-medium">
                                  <strong>Admin note:</strong> {ver.adminNotes}
                                </p>
                              )}
                            </div>
                          </div>

                          {ver.status === "pending" && (
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === ver.id}
                                onClick={() => {
                                  setModReason("");
                                  setModModal({
                                    kind: "reject_verification",
                                    targetId: ver.id,
                                    targetName: applicant?.fullName || "User",
                                    title: `Reject Verification (${applicant?.fullName || "User"})`,
                                    placeholder: "Explain why the document could not be verified (e.g., blurry photo, expired ID)...",
                                  });
                                }}
                                className="gap-1.5 text-xs font-bold border-rose-300 text-rose-800 hover:bg-rose-50"
                              >
                                <XCircle className="h-4 w-4" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                disabled={busyId === ver.id}
                                onClick={() => handleApproveVerification(ver.id)}
                                className="gap-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Approve &amp; Verify
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ==================== TAB 4: USER MANAGEMENT ==================== */}
            {activeTab === "users" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search users by name, email, or area..."
                      className="pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: "all", label: "All" },
                        { id: "og", label: "Older (60+)" },
                        { id: "yg", label: "Younger (<60)" },
                        { id: "active", label: "Active" },
                        { id: "verified", label: "Verified" },
                        { id: "warned", label: "Warned" },
                        { id: "banned", label: "Banned" },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setUserFilter(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          userFilter === f.id
                            ? "bg-foreground text-background border-foreground"
                            : "bg-card text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredUsers.map((u) => {
                    const active = isUserActive(u, appState);
                    const userWarnings = warnings.filter((w) => w.userId === u.id);
                    return (
                      <div
                        key={u.id}
                        className={`rounded-2xl border-2 p-4 flex flex-col justify-between gap-3 ${
                          u.isBanned
                            ? "border-rose-300 bg-rose-50/40"
                            : "border-border bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-11 w-11 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                              {u.avatarUrl ? (
                                <img
                                  src={u.avatarUrl}
                                  alt={u.fullName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                initials(u.fullName)
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Link
                                  href={`/profile/${u.id}`}
                                  className="font-bold text-foreground hover:text-primary truncate"
                                >
                                  {u.fullName}
                                </Link>
                                <VerifiedBadge status={u.verificationStatus} compact />
                                {u.isAdmin && (
                                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-primary/15 text-primary uppercase">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {u.email || "Demo member"} · {u.location || "Nagasaki"}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              u.userGroup === "og"
                                ? "bg-[#B4441A]/15 text-[#B4441A]"
                                : "bg-[#3F7356]/15 text-[#3F7356]"
                            }`}
                          >
                            {u.userGroup === "og" ? "Older (60+)" : "Younger (<60)"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded-full font-semibold ${
                              u.isBanned
                                ? "bg-rose-100 text-rose-800"
                                : active
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {u.isBanned ? "Banned" : active ? "Active" : "Inactive"}
                          </span>
                          {(u.warningsCount ?? 0) > 0 && (
                            <span className="px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-900">
                              {u.warningsCount} warning(s)
                            </span>
                          )}
                          {u.banReason && (
                            <span className="text-rose-700 truncate max-w-full">
                              Reason: {u.banReason}
                            </span>
                          )}
                        </div>

                        {userWarnings.length > 0 && (
                          <p className="text-[11px] text-amber-900 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-200">
                            Latest warning: {userWarnings[0].reason}
                          </p>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                          <Button asChild size="sm" variant="ghost" className="text-xs font-bold">
                            <Link href={`/profile/${u.id}`}>View Profile</Link>
                          </Button>
                          {u.id !== session?.id && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setModReason("");
                                  setModModal({
                                    kind: "warn",
                                    targetId: u.id,
                                    targetName: u.fullName,
                                    title: `Warn User (${u.fullName})`,
                                    placeholder: "Enter warning message for this user...",
                                  });
                                }}
                                className="text-xs font-bold gap-1 border-amber-300 text-amber-900"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Warn
                              </Button>
                              {u.isBanned ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busyId === u.id}
                                  onClick={() => handleUnban(u.id)}
                                  className="text-xs font-bold gap-1 border-emerald-300 text-emerald-800"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Unban
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setModReason("");
                                    setModModal({
                                      kind: "ban",
                                      targetId: u.id,
                                      targetName: u.fullName,
                                      title: `Ban User (${u.fullName})`,
                                      placeholder: "Reason for banning this user...",
                                    });
                                  }}
                                  className="text-xs font-bold gap-1 border-rose-300 text-rose-800"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                  Ban
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Document Full Preview Modal */}
      <Dialog
        open={Boolean(previewDoc)}
        onOpenChange={(open) => {
          if (!open) setPreviewDoc(null);
        }}
        title={previewDoc ? `Verification Document — ${previewDoc.documentName}` : "Document Preview"}
      >
        {previewDoc && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-2 max-h-[65vh] overflow-auto flex items-center justify-center">
              {previewDoc.documentUrl.startsWith("data:application/pdf") ? (
                <iframe
                  src={previewDoc.documentUrl}
                  title={previewDoc.documentName}
                  className="w-full h-[55vh] rounded-lg"
                />
              ) : (
                <img
                  src={previewDoc.documentUrl}
                  alt={previewDoc.documentName}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreviewDoc(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Moderation Reason Modal */}
      <Dialog
        open={Boolean(modModal)}
        onOpenChange={(open) => {
          if (!open) {
            setModModal(null);
            setModReason("");
          }
        }}
        title={modModal?.title || "Moderation Action"}
      >
        <form onSubmit={handleSubmitModModal} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="mod-reason" className="text-sm font-bold text-foreground">
              Reason / Official Note
            </label>
            <Textarea
              id="mod-reason"
              rows={3}
              required
              value={modReason}
              onChange={(e) => setModReason(e.target.value)}
              placeholder={modModal?.placeholder}
              maxLength={300}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModModal(null);
                setModReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!modReason.trim() || busyId !== null}
              variant={modModal?.kind === "ban" ? "destructive" : "default"}
              className="font-bold"
            >
              {modModal?.kind === "ban"
                ? "Confirm Ban"
                : modModal?.kind === "warn"
                ? "Send Warning"
                : "Reject Submission"}
            </Button>
          </div>
        </form>
      </Dialog>
    </AuthGuard>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: typeof Users;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-sm flex items-start justify-between gap-4">
      <div className="space-y-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        <p className="text-3xl font-black text-foreground tabular-nums">{value}</p>
        <p className="text-xs font-medium text-muted-foreground">{subtitle}</p>
      </div>
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="text-lg font-black text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function ProfileSnapshotCard({
  label,
  user,
  fallbackId,
}: {
  label: string;
  user?: Profile;
  fallbackId: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      {user ? (
        <>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
              ) : (
                initials(user.fullName)
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <Link
                  href={`/profile/${user.id}`}
                  className="font-bold text-sm text-foreground hover:text-primary truncate"
                >
                  {user.fullName}
                </Link>
                <VerifiedBadge status={user.verificationStatus} compact />
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {user.userGroup === "og" ? "Older (60+)" : "Younger (<60)"} · {user.email || "Member"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(user.warningsCount ?? 0) > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                {user.warningsCount} warning(s)
              </span>
            )}
            {user.isBanned && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                Banned
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">User ID: {fallbackId}</p>
      )}
    </div>
  );
}

function ReportStatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
        <Clock className="h-3 w-3" />
        Pending Review
      </span>
    );
  }
  if (status === "dismissed_fake") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
        <XCircle className="h-3 w-3" />
        Fake Report Dismissed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
      <CheckCircle2 className="h-3 w-3" />
      Resolved ({status.replace("resolved_", "")})
    </span>
  );
}
