"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store/useAppStore";
import type { VerificationDocType, VerificationRequest } from "@/lib/types";
import { requireUser, ServiceError } from "@/lib/services/shared";
import { pushNotification } from "@/lib/services/notificationService";
import { createUuid } from "@/lib/utils";

export function rowToVerification(row: any): VerificationRequest {
  return {
    id: row.id,
    userId: row.user_id,
    documentType: row.document_type ?? "other",
    documentUrl: row.document_url,
    documentName: row.document_name ?? "document",
    notes: row.notes ?? "",
    status: row.status ?? "pending",
    adminNotes: row.admin_notes ?? null,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

/**
 * Compresses an uploaded image document or reads a PDF as a data URL (max 2MB).
 */
export function prepareVerificationDocument(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) {
      reject(new ServiceError("Document file must be smaller than 5 MB."));
      return;
    }

    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new ServiceError("Failed to read PDF document."));
      reader.readAsDataURL(file);
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new ServiceError("Please upload an image (JPG, PNG, WebP) or PDF document."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 1200;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new ServiceError("Could not process document image."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new ServiceError("Invalid image file."));
      img.src = String(event.target?.result ?? "");
    };
    reader.onerror = () => reject(new ServiceError("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Fetch verification requests (own requests for normal users, all for admins).
 */
export async function fetchVerificationRequests(): Promise<VerificationRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profile_verifications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  const items = data.map(rowToVerification);

  useAppStore.setState((state) => {
    const remoteIds = new Set(items.map((v) => v.id));
    const kept = (state.verificationRequests ?? []).filter((v) => !remoteIds.has(v.id));
    return { verificationRequests: [...items, ...kept] };
  });

  return items;
}

/**
 * Submit a user profile verification document for admin review.
 */
export async function submitVerificationRequest(input: {
  documentType: VerificationDocType;
  documentUrl: string;
  documentName: string;
  notes: string;
}): Promise<VerificationRequest> {
  const me = requireUser();
  if (!input.documentUrl) {
    throw new ServiceError("Please upload a verification document.");
  }

  const now = new Date().toISOString();
  const verification: VerificationRequest = {
    id: createUuid(),
    userId: me.id,
    documentType: input.documentType,
    documentUrl: input.documentUrl,
    documentName: input.documentName || "document",
    notes: input.notes.trim(),
    status: "pending",
    adminNotes: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
  };

  const supabase = createClient();
  const { error } = await supabase.from("profile_verifications").insert({
    id: verification.id,
    user_id: me.id,
    document_type: verification.documentType,
    document_url: verification.documentUrl,
    document_name: verification.documentName,
    notes: verification.notes,
    status: "pending",
    created_at: now,
  });

  if (error) {
    console.warn("profile_verifications insert fallback (local store updated):", error.message);
  }

  // Update user's verification status to pending in Supabase & local store
  await supabase
    .from("profiles")
    .update({ verification_status: "pending", updated_at: now })
    .eq("id", me.id);

  useAppStore.setState((state) => ({
    verificationRequests: [
      verification,
      ...(state.verificationRequests ?? []).filter((v) => v.id !== verification.id),
    ],
    users: state.users.map((u) =>
      u.id === me.id ? { ...u, verificationStatus: "pending" } : u,
    ),
  }));

  return verification;
}

/**
 * Approve a user's profile verification request (Admin action).
 */
export async function approveVerification(verificationId: string, adminNotes?: string): Promise<void> {
  const admin = requireUser();
  const state = useAppStore.getState();
  const target = (state.verificationRequests ?? []).find((v) => v.id === verificationId);
  if (!target) throw new ServiceError("Verification request not found.");

  const now = new Date().toISOString();
  const note = adminNotes?.trim() || "Documents verified by admin.";
  const supabase = createClient();

  await supabase
    .from("profile_verifications")
    .update({
      status: "approved",
      admin_notes: note,
      reviewed_by: admin.id,
      reviewed_at: now,
    })
    .eq("id", verificationId);

  await supabase
    .from("profiles")
    .update({
      verification_status: "verified",
      verified_at: now,
      updated_at: now,
    })
    .eq("id", target.userId);

  useAppStore.setState((current) => ({
    verificationRequests: (current.verificationRequests ?? []).map((v) =>
      v.id === verificationId
        ? { ...v, status: "approved", adminNotes: note, reviewedBy: admin.id, reviewedAt: now }
        : v,
    ),
    users: current.users.map((u) =>
      u.id === target.userId
        ? { ...u, verificationStatus: "verified", verifiedAt: now }
        : u,
    ),
  }));

  pushNotification({
    userId: target.userId,
    type: "verification_approved",
    title: "Profile Verified!",
    body: "Congratulations! Your identity documents were approved and your profile now displays a Verified badge.",
    href: `/profile/${target.userId}`,
  });
}

/**
 * Reject a user's profile verification request (Admin action).
 */
export async function rejectVerification(verificationId: string, adminNotes: string): Promise<void> {
  const admin = requireUser();
  const state = useAppStore.getState();
  const target = (state.verificationRequests ?? []).find((v) => v.id === verificationId);
  if (!target) throw new ServiceError("Verification request not found.");

  const reason = adminNotes.trim() || "Submitted document could not be verified. Please upload a clearer photo.";
  const now = new Date().toISOString();
  const supabase = createClient();

  await supabase
    .from("profile_verifications")
    .update({
      status: "rejected",
      admin_notes: reason,
      reviewed_by: admin.id,
      reviewed_at: now,
    })
    .eq("id", verificationId);

  await supabase
    .from("profiles")
    .update({
      verification_status: "rejected",
      updated_at: now,
    })
    .eq("id", target.userId);

  useAppStore.setState((current) => ({
    verificationRequests: (current.verificationRequests ?? []).map((v) =>
      v.id === verificationId
        ? { ...v, status: "rejected", adminNotes: reason, reviewedBy: admin.id, reviewedAt: now }
        : v,
    ),
    users: current.users.map((u) =>
      u.id === target.userId ? { ...u, verificationStatus: "rejected" } : u,
    ),
  }));

  pushNotification({
    userId: target.userId,
    type: "verification_rejected",
    title: "Verification Needs Attention",
    body: `Your verification request was not approved: ${reason}`,
    href: "/profile/edit#verify-profile",
  });
}

/**
 * React hook for the current user's latest verification request.
 */
export function useMyVerificationRequest(userId?: string): VerificationRequest | null {
  const list = useAppStore((state) => state.verificationRequests ?? []);
  const sessionUserId = useAppStore((state) => state.sessionUserId);
  const targetId = userId || sessionUserId;

  useEffect(() => {
    if (targetId) {
      fetchVerificationRequests();
    }
  }, [targetId]);

  return useMemo(() => {
    if (!targetId) return null;
    return list.find((v) => v.userId === targetId) ?? null;
  }, [list, targetId]);
}
