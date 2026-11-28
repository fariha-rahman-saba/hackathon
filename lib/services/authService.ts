"use client";

import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store/useAppStore";
import type { Profile, UserGroup } from "@/lib/types";
import { ServiceError, requireUser } from "@/lib/services/shared";
import { detectGeneration, placeByName, MIN_AGE } from "@/lib/constants";

/**
 * Maps Supabase snake_case profiles table row to the domain Profile type
 */
export function rowToProfile(row: any): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name || "",
    avatarUrl: row.avatar_url ?? null,
    age: row.age ?? null,
    ageGroup: row.age_group ?? null,
    location: row.location ?? "",
    neighborhoods: row.neighborhoods && Array.isArray(row.neighborhoods) && row.neighborhoods.length > 0
      ? row.neighborhoods
      : row.location
      ? [row.location]
      : [],
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    bio: row.bio ?? "",
    interests: row.interests ?? [],
    skills: row.skills ?? [],
    servicesOffered: row.services_offered ?? [],
    servicesNeeded: row.services_needed ?? [],
    availability: row.availability ?? "Flexible",
    contactMethod: row.contact_method ?? "chat",
    phone: row.phone ?? null,
    userGroup: (row.user_group as UserGroup) || "yg",
    isAdmin: Boolean(row.is_admin),
    isBanned: Boolean(row.is_banned),
    banReason: row.ban_reason ?? null,
    warningsCount: typeof row.warnings_count === "number" ? row.warnings_count : 0,
    lastActiveAt: row.last_active_at ?? row.updated_at ?? row.created_at ?? null,
    verificationStatus: row.verification_status ?? "unverified",
    verifiedAt: row.verified_at ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

/**
 * Maps domain Profile fields to Supabase snake_case columns
 */
export function profileToRow(profile: Partial<Profile>): Record<string, any> {
  const row: Record<string, any> = {};
  if (profile.id !== undefined) row.id = profile.id;
  if (profile.email !== undefined) row.email = profile.email;
  if (profile.fullName !== undefined) row.full_name = profile.fullName;
  if (profile.avatarUrl !== undefined) row.avatar_url = profile.avatarUrl;
  if (profile.age !== undefined) row.age = profile.age;
  if (profile.ageGroup !== undefined) row.age_group = profile.ageGroup;
  if (profile.location !== undefined) row.location = profile.location;
  if (profile.neighborhoods !== undefined) row.neighborhoods = profile.neighborhoods;
  if (profile.lat !== undefined) row.lat = profile.lat;
  if (profile.lng !== undefined) row.lng = profile.lng;
  if (profile.bio !== undefined) row.bio = profile.bio;
  if (profile.interests !== undefined) row.interests = profile.interests;
  if (profile.skills !== undefined) row.skills = profile.skills;
  if (profile.servicesOffered !== undefined) row.services_offered = profile.servicesOffered;
  if (profile.servicesNeeded !== undefined) row.services_needed = profile.servicesNeeded;
  if (profile.availability !== undefined) row.availability = profile.availability;
  if (profile.contactMethod !== undefined) row.contact_method = profile.contactMethod;
  if (profile.phone !== undefined) row.phone = profile.phone;
  if (profile.userGroup !== undefined) row.user_group = profile.userGroup;
  if (profile.isAdmin !== undefined) row.is_admin = profile.isAdmin;
  if (profile.isBanned !== undefined) row.is_banned = profile.isBanned;
  if (profile.banReason !== undefined) row.ban_reason = profile.banReason;
  if (profile.warningsCount !== undefined) row.warnings_count = profile.warningsCount;
  if (profile.lastActiveAt !== undefined) row.last_active_at = profile.lastActiveAt;
  if (profile.verificationStatus !== undefined) row.verification_status = profile.verificationStatus;
  if (profile.verifiedAt !== undefined) row.verified_at = profile.verifiedAt;
  row.updated_at = new Date().toISOString();
  return row;
}

/**
 * Helper to sync the current user profile into the in-memory store
 */
export function syncSessionUser(profile: Profile) {
  useAppStore.setState((state) => {
    const exists = state.users.some((u) => u.id === profile.id);
    return {
      sessionUserId: profile.id,
      users: exists ? state.users.map((u) => (u.id === profile.id ? profile : u)) : [...state.users, profile],
    };
  });
}

/**
 * React hook to get the current authenticated session user profile
 */
export function useSession(): Profile | null {
  const userId = useAppStore((state) => state.sessionUserId);
  const users = useAppStore((state) => state.users);
  if (!userId) return null;
  const found = users.find((user) => user.id === userId);
  if (found) return found;

  // Fallback profile until full profile row loads from Supabase
  return {
    id: userId,
    email: "",
    fullName: "User",
    avatarUrl: null,
    age: null,
    ageGroup: null,
    location: "",
    neighborhoods: [],
    lat: null,
    lng: null,
    bio: "",
    interests: [],
    skills: [],
    servicesOffered: [],
    servicesNeeded: [],
    availability: "Flexible",
    contactMethod: "chat",
    phone: null,
    userGroup: "yg",
    createdAt: new Date().toISOString(),
  };
}

/** Turns Supabase auth errors into plain-language messages for members. */
function friendlySignInError(message?: string): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
    return "Email or password is incorrect. Please try again, or use Forgot password.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email first — check your inbox for the link we sent when you registered.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("fetch") || m.includes("network"))
    return "We couldn't reach the server. Please check your internet connection.";
  return message || "We couldn't log you in. Please try again.";
}

function friendlySignUpError(message?: string): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("already registered") || m.includes("already exists") || m.includes("user_already_exists"))
    return "An account with this email already exists. Please log in instead, or use Forgot password.";
  if (m.includes("password")) return message || "Please choose a stronger password.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("invalid") && m.includes("email")) return "Please enter a valid email address.";
  if (m.includes("fetch") || m.includes("network"))
    return "We couldn't reach the server. Please check your internet connection.";
  return message || "We couldn't create your account. Please try again.";
}

/**
 * Sign in using Supabase Auth
 */
export async function signIn(email: string, password: string): Promise<Profile> {
  const normalized = email.trim().toLowerCase();
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalized,
    password,
  });

  if (error) {
    throw new ServiceError(friendlySignInError(error.message));
  }

  if (!data.user) {
    throw new ServiceError("Failed to authenticate user.");
  }

  // Fetch user profile from Supabase
  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profileRow) {
    // If profile row doesn't exist yet, construct and insert a fallback profile
    const fallbackProfile: Profile = {
      id: data.user.id,
      email: normalized,
      fullName: data.user.user_metadata?.full_name || normalized.split("@")[0] || "Member",
      avatarUrl: data.user.user_metadata?.avatar_url || null,
      age: data.user.user_metadata?.age ?? null,
      ageGroup: data.user.user_metadata?.age_group ?? null,
      location: data.user.user_metadata?.location || "",
      neighborhoods: data.user.user_metadata?.neighborhoods || [],
      lat: null,
      lng: null,
      bio: "",
      interests: [],
      skills: [],
      servicesOffered: [],
      servicesNeeded: [],
      availability: "Flexible",
      contactMethod: "chat",
      phone: null,
      userGroup: (data.user.user_metadata?.user_group as UserGroup) || "yg",
      createdAt: data.user.created_at || new Date().toISOString(),
    };

    await supabase.from("profiles").upsert(profileToRow(fallbackProfile));
    syncSessionUser(fallbackProfile);
    return fallbackProfile;
  }

  const profile = rowToProfile(profileRow);
  syncSessionUser(profile);
  return profile;
}

/**
 * Sign up a new user using Supabase Auth and create their profile
 */
export async function signUp(input: {
  email: string;
  password: string;
  fullName: string;
  age?: number;
  neighborhood?: string;
  neighborhoods?: string[];
  userGroup?: UserGroup;
}): Promise<{ profile: Profile; needsEmailConfirmation: boolean }> {
  const normalized = input.email.trim().toLowerCase();

  // Minimum age to join (mirrors the register form)
  if (typeof input.age !== "number" || !Number.isInteger(input.age) || input.age < MIN_AGE) {
    throw new ServiceError(`You must be at least ${MIN_AGE} years old to join Musubi.`);
  }

  // Same rule as the register / reset / change password forms
  if (input.password.length < 8 || !/[A-Za-z]/.test(input.password) || !/\d/.test(input.password)) {
    throw new ServiceError("Use at least 8 characters, including a letter and a number.");
  }

  const age = input.age ?? null;
  let userGroup = input.userGroup || "yg";
  let ageGroup = null;

  if (age !== null && age !== undefined) {
    const gen = detectGeneration(age);
    userGroup = gen.userGroup;
    ageGroup = gen.ageGroup;
  }

  const neighborhoods = input.neighborhoods ?? (input.neighborhood ? [input.neighborhood] : []);
  const location = neighborhoods[0] || input.neighborhood || "";
  const place = placeByName(location);

  const supabase = createClient();

  // 1. Create auth user in Supabase
  const { data, error } = await supabase.auth.signUp({
    email: normalized,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        age,
        age_group: ageGroup,
        user_group: userGroup,
        location,
        neighborhoods,
      },
    },
  });

  if (error) {
    throw new ServiceError(friendlySignUpError(error.message));
  }

  if (!data.user) {
    throw new ServiceError("Registration failed. Please try again.");
  }

  // Supabase returns a user with no identities when the email is already taken
  // (to avoid leaking account existence), and no session when email
  // confirmation is required.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new ServiceError(friendlySignUpError("already registered"));
  }
  const needsEmailConfirmation = !data.session;

  // 2. Build initial Profile
  const profile: Profile = {
    id: data.user.id,
    email: normalized,
    fullName: input.fullName.trim(),
    avatarUrl: null,
    age,
    ageGroup,
    location,
    neighborhoods,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
    bio: "",
    interests: [],
    skills: [],
    servicesOffered: [],
    servicesNeeded: [],
    availability: "Flexible",
    contactMethod: "chat",
    phone: null,
    userGroup,
    createdAt: new Date().toISOString(),
  };

  // 3. Upsert profile into public.profiles table
  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(profileToRow(profile));

  if (upsertError) {
    console.warn("Could not insert profile immediately:", upsertError.message);
  }

  // Only treat the user as signed in when Supabase actually created a session
  if (!needsEmailConfirmation) syncSessionUser(profile);
  return { profile, needsEmailConfirmation };
}

/**
 * Sign in / Sign up with Google OAuth
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = createClient();
  const redirectTo = typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : undefined;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    throw new ServiceError(error.message || "Failed to start Google sign-in.");
  }
}

/**
 * Sign out of Supabase
 */
export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  useAppStore.setState({ sessionUserId: null });
}

/**
 * Update basic account details (name, email, user group)
 */
export async function updateAccount(input: {
  fullName: string;
  email: string;
  userGroup: UserGroup;
}): Promise<Profile> {
  const me = requireUser();
  const email = input.email.trim().toLowerCase();
  const supabase = createClient();

  // If email changed, update auth.users
  if (email !== me.email) {
    const { error: authError } = await supabase.auth.updateUser({ email });
    if (authError) throw new ServiceError(authError.message);
  }

  const next: Profile = {
    ...me,
    fullName: input.fullName.trim(),
    email,
    userGroup: input.userGroup,
  };

  const { error } = await supabase
    .from("profiles")
    .update(profileToRow({ fullName: next.fullName, email: next.email, userGroup: next.userGroup }))
    .eq("id", me.id);

  if (error) {
    throw new ServiceError(error.message || "Failed to update account.");
  }

  syncSessionUser(next);
  return next;
}

/* -------------------------------------------------------------------------- */
/* Passwords                                                                  */
/* -------------------------------------------------------------------------- */

function friendlyAuthError(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("security purposes") || m.includes("only request this after")) {
    return "Too many requests. Please wait a minute and try again.";
  }
  if (m.includes("same") && m.includes("password")) {
    return "Your new password must be different from your current password.";
  }
  if (m.includes("weak") || m.includes("at least")) {
    return message;
  }
  if (m.includes("reauthentication")) {
    return "For security, please sign out and sign in again, then retry.";
  }
  if (m.includes("session") && (m.includes("missing") || m.includes("expired"))) {
    return "Your reset link has expired. Please request a new one.";
  }
  return message;
}

/**
 * Sends a password-reset email. The link returns through /auth/callback,
 * which exchanges the code for a recovery session and forwards the user to
 * /reset-password. Always resolves without revealing whether the email
 * exists (only rate-limit / network errors are surfaced).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const supabase = createClient();
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`
      : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(normalized, { redirectTo });
  if (error) {
    const m = error.message?.toLowerCase() ?? "";
    // Don't leak account existence; only surface actionable errors
    if (m.includes("rate limit") || m.includes("security purposes") || m.includes("only request this after") || m.includes("fetch")) {
      throw new ServiceError(friendlyAuthError(error.message, "Could not send the reset email."));
    }
    console.warn("resetPasswordForEmail:", error.message);
  }
}

/** True when the current browser holds an authenticated (or recovery) session. */
export async function hasActiveSession(): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

/**
 * Sets a new password for the signed-in user. Used after following a reset
 * link (recovery session) and by changePassword once the current password is
 * verified.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new ServiceError(friendlyAuthError(error.message, "Could not update your password."));
}

/** Whether the signed-in account has an email/password identity (vs Google only). */
export async function accountHasPassword(): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return false;
  const providers: string[] = (user.app_metadata?.providers as string[]) ?? [];
  if (providers.includes("email")) return true;
  return (user.identities ?? []).some((identity) => identity.provider === "email");
}

/**
 * Changes the password for a signed-in user. When the account already has a
 * password, the current one is verified first so a hijacked open session
 * can't silently change it.
 */
export async function changePassword(input: { currentPassword?: string; newPassword: string }): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) throw new ServiceError("Please sign in again to change your password.");

  if (await accountHasPassword()) {
    if (!input.currentPassword) throw new ServiceError("Please enter your current password.");
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: input.currentPassword,
    });
    if (verifyError) {
      const m = verifyError.message.toLowerCase();
      throw new ServiceError(
        m.includes("invalid") ? "Your current password is incorrect." : friendlyAuthError(verifyError.message, "Could not verify your password.")
      );
    }
  }

  await updatePassword(input.newPassword);
}
