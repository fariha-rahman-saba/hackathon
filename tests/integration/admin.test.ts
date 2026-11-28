import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, opsOn } from "./fakeSupabase";
import { emptyState, member, post } from "./setup";

let fake = makeFakeSupabase();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => fake }));

import { useAppStore } from "@/lib/store/useAppStore";
import { requireUser } from "@/lib/services/shared";
import {
  banUserAsAdmin,
  computePlatformMetrics,
  deletePostAsAdmin,
  dismissFakeReport,
  unbanUserAsAdmin,
  warnUserAsAdmin,
} from "@/lib/services/adminService";
import {
  approveVerification,
  rejectVerification,
  submitVerificationRequest,
} from "@/lib/services/verificationService";

const NOW = new Date("2026-11-28T12:00:00Z").getTime();

beforeEach(() => {
  fake = makeFakeSupabase();
  useAppStore.setState(
    {
      ...emptyState(),
      users: [
        member("admin", { userGroup: "yg", isAdmin: true, lastActiveAt: "2026-11-27T00:00:00Z" }),
        member("hana", { userGroup: "og", lastActiveAt: "2026-11-26T00:00:00Z" }),
        member("old_inactive", { userGroup: "og", lastActiveAt: "2026-01-01T00:00:00Z" }),
        member("ken", { userGroup: "yg", lastActiveAt: "2026-11-25T00:00:00Z" }),
        member("banned_yg", { userGroup: "yg", isBanned: true, lastActiveAt: "2026-11-27T00:00:00Z" }),
      ],
      posts: [
        post({ id: "p1", authorId: "hana", status: "open" }),
        post({ id: "p2", authorId: "ken", status: "completed", category: "Cooking" }),
      ],
      reports: [
        {
          id: "rep1",
          reporterId: "ken",
          targetType: "post",
          targetId: "p1",
          reason: "Suspicious contact details",
          status: "pending",
          createdAt: "2026-11-28T01:00:00Z",
        },
      ],
      sessionUserId: "admin",
    },
    true,
  );
});

describe("admin monitoring metrics", () => {
  it("computes total, older, younger, and active user counts accurately", () => {
    const metrics = computePlatformMetrics(useAppStore.getState(), NOW);
    expect(metrics.totalUsers).toBe(5);
    expect(metrics.olderUsers).toBe(2); // hana, old_inactive
    expect(metrics.youngerUsers).toBe(3); // admin, ken, banned_yg
    expect(metrics.activeOlder).toBe(1); // hana (old_inactive has no recent activity)
    expect(metrics.activeYounger).toBe(2); // admin, ken (banned_yg excluded)
    expect(metrics.activeTotal).toBe(3);
    expect(metrics.bannedUsers).toBe(1);
    expect(metrics.pendingReports).toBe(1);
    expect(metrics.totalPosts).toBe(2);
  });
});

describe("admin report moderation", () => {
  it("deletes a reported post and resolves the report", async () => {
    await deletePostAsAdmin("p1", "rep1", "Violated guidelines");
    const state = useAppStore.getState();
    expect(state.posts.some((p) => p.id === "p1")).toBe(false);
    expect(state.reports.find((r) => r.id === "rep1")?.status).toBe("resolved_deleted");
    expect(opsOn(fake, "posts", "delete").length).toBe(1);
  });

  it("warns a post owner, increments warning count, and notifies them", async () => {
    await warnUserAsAdmin("hana", "Please keep posts accurate", "rep1", "resolved_warned");
    const state = useAppStore.getState();
    const hana = state.users.find((u) => u.id === "hana");
    expect(hana?.warningsCount).toBe(1);
    expect(state.warnings?.length).toBe(1);
    expect(state.reports[0].status).toBe("resolved_warned");
    expect(opsOn(fake, "notifications", "insert")[0].payload).toMatchObject({
      user_id: "hana",
      type: "warning",
    });
  });

  it("bans and unbans a user and blocks suspended users from acting", async () => {
    await banUserAsAdmin("ken", "Repeated fake reports", "rep1", "dismissed_fake");
    let state = useAppStore.getState();
    expect(state.users.find((u) => u.id === "ken")?.isBanned).toBe(true);
    expect(state.reports[0].status).toBe("dismissed_fake");

    useAppStore.setState({ sessionUserId: "ken" });
    expect(() => requireUser()).toThrow(/suspended/i);

    useAppStore.setState({ sessionUserId: "admin" });
    await unbanUserAsAdmin("ken");
    state = useAppStore.getState();
    expect(state.users.find((u) => u.id === "ken")?.isBanned).toBe(false);
  });

  it("dismisses a fake report", async () => {
    await dismissFakeReport("rep1", "False claim");
    expect(useAppStore.getState().reports[0].status).toBe("dismissed_fake");
  });
});

describe("profile verification workflow", () => {
  it("submits documents and lets admin approve or reject", async () => {
    useAppStore.setState({ sessionUserId: "hana" });
    const req = await submitVerificationRequest({
      documentType: "senior_card",
      documentUrl: "data:image/jpeg;base64,abc",
      documentName: "senior-id.jpg",
      notes: "Front of card",
    });
    expect(req.status).toBe("pending");
    expect(useAppStore.getState().users.find((u) => u.id === "hana")?.verificationStatus).toBe("pending");

    useAppStore.setState({ sessionUserId: "admin" });
    await approveVerification(req.id, "Clear ID");
    const hana = useAppStore.getState().users.find((u) => u.id === "hana");
    expect(hana?.verificationStatus).toBe("verified");
    expect(hana?.verifiedAt).toBeTruthy();

    // Test rejection on another user
    useAppStore.setState({ sessionUserId: "ken" });
    const req2 = await submitVerificationRequest({
      documentType: "student_id",
      documentUrl: "data:image/jpeg;base64,xyz",
      documentName: "blurry.jpg",
      notes: "",
    });
    useAppStore.setState({ sessionUserId: "admin" });
    await rejectVerification(req2.id, "Photo is blurry");
    const ken = useAppStore.getState().users.find((u) => u.id === "ken");
    expect(ken?.verificationStatus).toBe("rejected");
  });
});
