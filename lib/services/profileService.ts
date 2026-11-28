"use client";

import { useMemo, useState, useEffect } from "react";
import { placeByName, detectGeneration } from "@/lib/constants";
import { useAppStore } from "@/lib/store/useAppStore";
import type { Need, Profile, PublicProfile, Skill } from "@/lib/types";
import { average } from "@/lib/utils";
import { useSession, profileToRow, rowToProfile, syncSessionUser } from "@/lib/services/authService";
import { hiddenFrom, requireUser, ServiceError } from "@/lib/services/shared";
import { createClient } from "@/lib/supabase/client";

export type ProfilePatch = Partial<
  Pick<
    Profile,
    | "fullName"
    | "email"
    | "age"
    | "userGroup"
    | "ageGroup"
    | "location"
    | "neighborhoods"
    | "bio"
    | "interests"
    | "skills"
    | "servicesOffered"
    | "servicesNeeded"
    | "availability"
    | "contactMethod"
    | "phone"
    | "avatarUrl"
    | "lat"
    | "lng"
  >
>;

function connected(stateUserIds: { a: string; b: string }, requests: { requesterId: string; ownerId: string; status: string }[]) {
  return requests.some(
    (request) =>
      (request.status === "accepted" || request.status === "completed") &&
      ((request.requesterId === stateUserIds.a && request.ownerId === stateUserIds.b) ||
        (request.requesterId === stateUserIds.b && request.ownerId === stateUserIds.a)),
  );
}

/**
 * Converts a Profile object to a PublicProfile, enforcing privacy rules
 * (e.g. phone number only visible if an accepted connection exists).
 */
export function toPublicProfile(user: Profile, viewerId: string | null): PublicProfile {
  const state = useAppStore.getState();
  const received = state.reviews.filter((review) => review.revieweeId === user.id);
  const phoneShared = Boolean(
    viewerId &&
      viewerId !== user.id &&
      user.contactMethod === "phone" &&
      user.phone &&
      connected({ a: viewerId, b: user.id }, state.requests),
  );

  return {
    id: user.id,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    age: user.age ?? null,
    ageGroup: user.ageGroup,
    location: user.location,
    neighborhoods: user.neighborhoods ?? (user.location ? [user.location] : []),
    lat: user.lat,
    lng: user.lng,
    bio: user.bio,
    interests: user.interests,
    skills: user.skills,
    servicesOffered: user.servicesOffered,
    servicesNeeded: user.servicesNeeded,
    availability: user.availability,
    contactMethod: user.contactMethod,
    userGroup: user.userGroup,
    verificationStatus: user.verificationStatus ?? "unverified",
    isBanned: Boolean(user.isBanned),
    warningsCount: user.warningsCount ?? 0,
    createdAt: user.createdAt,
    phone: phoneShared ? user.phone : null,
    phoneShared,
    averageRating: average(received.map((review) => review.rating)),
    reviewCount: received.length,
    completedCount: state.activities.filter((activity) => activity.participantIds.includes(user.id)).length,
  };
}

export function listSkillRows(userId: string): Skill[] {
  const user = useAppStore.getState().users.find((item) => item.id === userId);
  if (!user) return [];
  return user.skills.map((name, index) => ({ id: `${userId}-skill-${index}-${name}`, userId, name }));
}

export function listNeedRows(userId: string): Need[] {
  const user = useAppStore.getState().users.find((item) => item.id === userId);
  if (!user) return [];
  return user.servicesNeeded.map((name, index) => ({ id: `${userId}-need-${index}-${name}`, userId, name }));
}

/**
 * Fetch all public profiles from Supabase PostgreSQL
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchProfiles(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  const profiles = data.map(rowToProfile);

  useAppStore.setState((state) => {
    const remoteIds = new Set(profiles.map((p) => p.id));
    // Keep only real accounts the server didn't return (e.g. the signed-in
    // member right after sign-up). Mock seed users ("u1".."u8") persisted in
    // the browser are dropped so they never appear as contactable people.
    const kept = state.users.filter((u) => !remoteIds.has(u.id) && UUID_RE.test(u.id));
    return { users: [...profiles, ...kept] };
  });

  return profiles;
}

/**
 * Fetch a profile directly from Supabase PostgreSQL by user ID
 */
export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  const profile = rowToProfile(data);
  // Cache in app store
  useAppStore.setState((state) => ({
    users: state.users.some((u) => u.id === profile.id)
      ? state.users.map((u) => (u.id === profile.id ? profile : u))
      : [...state.users, profile],
  }));

  return profile;
}

/**
 * Hook to retrieve a profile, reactively fetching from Supabase if not yet in cache
 */
export function useProfile(id: string | null): Profile | null {
  const users = useAppStore((state) => state.users);
  const blocks = useAppStore((state) => state.blocks);
  const viewerId = useAppStore((state) => state.sessionUserId);
  const [fetchedUser, setFetchedUser] = useState<Profile | null>(null);

  useEffect(() => {
    if (!id) return;
    const existing = users.find((item) => item.id === id);
    if (!existing) {
      getProfileById(id).then((profile) => {
        if (profile) setFetchedUser(profile);
      });
    }
  }, [id, users]);

  return useMemo(() => {
    if (!id) return null;
    const user = users.find((item) => item.id === id) ?? fetchedUser;
    if (!user) return null;
    if (hiddenFrom(blocks, viewerId, user.id)) return null;
    return user;
  }, [blocks, fetchedUser, id, users, viewerId]);
}

/**
 * Hook to retrieve a public profile by ID, fetching from Supabase if needed
 */
export function usePublicProfile(id: string): PublicProfile | null {
  const users = useAppStore((state) => state.users);
  const reviews = useAppStore((state) => state.reviews);
  const activities = useAppStore((state) => state.activities);
  const requests = useAppStore((state) => state.requests);
  const blocks = useAppStore((state) => state.blocks);
  const viewer = useSession();
  const [fetchedUser, setFetchedUser] = useState<Profile | null>(null);
  const remoteCompleted = useCompletedExchangeCount(id);

  useEffect(() => {
    if (!id) return;
    const existing = users.find((item) => item.id === id);
    if (!existing) {
      getProfileById(id).then((profile) => {
        if (profile) setFetchedUser(profile);
      });
    }
  }, [id, users]);

  return useMemo(() => {
    const user = users.find((item) => item.id === id) ?? fetchedUser;
    if (!user) return null;
    if (viewer && hiddenFrom(blocks, viewer.id, user.id)) return null;

    const received = reviews.filter((review) => review.revieweeId === user.id);
    const phoneShared = Boolean(
      viewer &&
        viewer.id !== user.id &&
        user.contactMethod === "phone" &&
        user.phone &&
        requests.some(
          (request) =>
            (request.status === "accepted" || request.status === "completed") &&
            ((request.requesterId === viewer.id && request.ownerId === user.id) ||
              (request.requesterId === user.id && request.ownerId === viewer.id)),
        ),
    );

    const profile: PublicProfile = {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      age: user.age ?? null,
      ageGroup: user.ageGroup,
      location: user.location,
      neighborhoods: user.neighborhoods ?? (user.location ? [user.location] : []),
      lat: user.lat,
      lng: user.lng,
      bio: user.bio,
      interests: user.interests,
      skills: user.skills,
      servicesOffered: user.servicesOffered,
      servicesNeeded: user.servicesNeeded,
      availability: user.availability,
      contactMethod: user.contactMethod,
      userGroup: user.userGroup,
      verificationStatus: user.verificationStatus ?? "unverified",
      isBanned: Boolean(user.isBanned),
      warningsCount: user.warningsCount ?? 0,
      createdAt: user.createdAt,
      phone: phoneShared ? user.phone : null,
      phoneShared,
      averageRating: average(received.map((review) => review.rating)),
      reviewCount: received.length,
      completedCount: Math.max(remoteCompleted ?? 0, activities.filter((activity) => activity.participantIds.includes(user.id)).length),
    };
    return profile;
  }, [activities, blocks, fetchedUser, id, remoteCompleted, requests, reviews, users, viewer]);
}

/**
 * Number of completed exchanges for any member, via the
 * `completed_exchange_count` database function (activities themselves are
 * private). Also loads my own activities so my shared exchanges count even
 * before that function is installed. null = unknown.
 */
let lastActivityFetch = 0;

export function useCompletedExchangeCount(userId: string | null | undefined): number | null {
  const [count, setCount] = useState<number | null>(null);
  const signedIn = useAppStore((state) => Boolean(state.sessionUserId));
  const activityCount = useAppStore((state) => state.activities.length);

  useEffect(() => {
    // Shared by every profile card on a page: refresh my activities at most every 30 s
    if (!signedIn || Date.now() - lastActivityFetch < 30_000) return;
    lastActivityFetch = Date.now();
    import("@/lib/services/requestService").then(({ fetchRequests }) => fetchRequests()).catch(() => {});
  }, [signedIn]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    createClient()
      .rpc("completed_exchange_count", { uid: userId })
      .then(({ data, error }) => {
        if (alive) setCount(!error && typeof data === "number" ? data : null);
      });
    return () => {
      alive = false;
    };
  }, [userId, activityCount]);

  return count;
}

/**
 * Hook to retrieve user activity and review statistics
 */
export function useUserStats(userId: string) {
  const reviews = useAppStore((state) => state.reviews);
  const activities = useAppStore((state) => state.activities);
  const remoteCompleted = useCompletedExchangeCount(userId);
  return useMemo(() => {
    const received = reviews.filter((review) => review.revieweeId === userId);
    return {
      averageRating: average(received.map((review) => review.rating)),
      reviewCount: received.length,
      completedCount: Math.max(remoteCompleted ?? 0, activities.filter((activity) => activity.participantIds.includes(userId)).length),
    };
  }, [activities, remoteCompleted, reviews, userId]);
}

/**
 * Updates the authenticated user's profile in Supabase PostgreSQL
 * and synchronizes with local state and normalized tables.
 */
export async function updateProfile(patch: ProfilePatch): Promise<Profile> {
  const me = requireUser();

  // Only check email if user is trying to change to a different email address
  if (patch.email && patch.email.trim().toLowerCase() !== me.email.toLowerCase()) {
    const email = patch.email.trim().toLowerCase();
    const supabase = createClient();
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .neq("id", me.id)
      .maybeSingle();

    if (existing) {
      throw new ServiceError("That email is already used by another member.");
    }
    patch = { ...patch, email };
  } else {
    // Keep verified authenticated email
    delete patch.email;
  }

  // Automatic Generation Detection (OG vs YG) from age
  if (patch.age !== undefined && patch.age !== null) {
    const gen = detectGeneration(patch.age);
    patch = {
      ...patch,
      userGroup: gen.userGroup,
      ageGroup: gen.ageGroup,
    };
  }

  if (patch.neighborhoods && patch.neighborhoods.length > 0 && !patch.location) {
    patch = {
      ...patch,
      location: patch.neighborhoods[0],
    };
  }

  const location = patch.location ?? me.location;
  const place = placeByName(location);
  const neighborhoods = patch.neighborhoods ?? me.neighborhoods ?? (location ? [location] : []);

  const next: Profile = {
    ...me,
    ...patch,
    fullName: (patch.fullName ?? me.fullName).trim(),
    bio: (patch.bio ?? me.bio).trim(),
    location,
    neighborhoods,
    // A pin the member set themselves wins; otherwise use the known area's centre
    lat: "lat" in patch ? (patch.lat ?? place?.lat ?? null) : (place?.lat ?? (location === me.location ? me.lat : null)),
    lng: "lng" in patch ? (patch.lng ?? place?.lng ?? null) : (place?.lng ?? (location === me.location ? me.lng : null)),
    phone: patch.contactMethod === "chat" ? null : (patch.phone ?? me.phone),
    interests: patch.interests ?? me.interests,
    skills: patch.skills ?? me.skills,
    servicesOffered: patch.servicesOffered ?? me.servicesOffered,
    servicesNeeded: patch.servicesNeeded ?? me.servicesNeeded,
  };

  const supabase = createClient();
  const dbRow = profileToRow(next);

  // 1. Update in Supabase profiles table
  const { error } = await supabase.from("profiles").upsert(dbRow);
  if (error) {
    console.error("Failed to update profile in Supabase:", error);
    throw new ServiceError(error.message || "Failed to update profile in database.");
  }

  // 2. Sync normalized skills table if skills were provided
  if (patch.skills !== undefined) {
    try {
      await supabase.from("skills").delete().eq("user_id", me.id);
      if (patch.skills.length > 0) {
        await supabase.from("skills").insert(
          patch.skills.map((name) => ({ user_id: me.id, name }))
        );
      }
    } catch (skillErr) {
      console.warn("Could not sync normalized skills:", skillErr);
    }
  }

  // 3. Sync normalized needs table if servicesNeeded were provided
  if (patch.servicesNeeded !== undefined) {
    try {
      await supabase.from("needs").delete().eq("user_id", me.id);
      if (patch.servicesNeeded.length > 0) {
        await supabase.from("needs").insert(
          patch.servicesNeeded.map((name) => ({ user_id: me.id, name }))
        );
      }
    } catch (needErr) {
      console.warn("Could not sync normalized needs:", needErr);
    }
  }

  // 4. Update local application store
  syncSessionUser(next);

  return next;
}

/**
 * Updates the authenticated user's avatar image URL in Supabase
 */
export async function updateAvatar(dataUrl: string | null): Promise<void> {
  const me = requireUser();
  const supabase = createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: dataUrl, updated_at: new Date().toISOString() })
    .eq("id", me.id);

  if (error) {
    throw new ServiceError(error.message || "Failed to update avatar.");
  }

  useAppStore.setState((state) => ({
    users: state.users.map((user) => (user.id === me.id ? { ...user, avatarUrl: dataUrl } : user)),
  }));
}
