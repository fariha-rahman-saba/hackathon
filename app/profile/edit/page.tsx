"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User,
  AlertCircle,
  Save,
  MapPin,
  Camera,
  Trash2,
  ArrowLeft,
  MessageSquare,
  Phone,
  Check,
  BookOpen,
  HelpCircle,
  CalendarClock,
  Heart,
  KeyRound,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { profileSchema, type ProfileValues } from "@/lib/validators";
import { useSession } from "@/lib/services/authService";
import { updateProfile } from "@/lib/services/profileService";
import { initials } from "@/lib/utils";
import {
  POPULAR_NEIGHBORHOODS,
  SUGGESTED_SKILLS,
  SUGGESTED_SERVICES,
  SUGGESTED_INTERESTS,
  detectGeneration, MIN_AGE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { AuthGuard } from "@/components/common/AuthGuard";
import { useProfileCompletion } from "@/lib/profileCompletion";
import { TagPicker, AgeGroupBadge } from "@/components/profile/TagPicker";
import { AvailabilityPicker } from "@/components/profile/AvailabilityPicker";
import { MyLocationPicker, type MyLocation } from "@/components/profile/MyLocationPicker";
import { ProfileVerificationSection } from "@/components/profile/ProfileVerificationSection";

export default function EditProfilePage() {
  const router = useRouter();
  const completion = useProfileCompletion();
  const [returningToPost, setReturningToPost] = useState(false);
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next") ?? "";
    setReturningToPost(next.startsWith("/quick-post") || next.startsWith("/posts/new"));
  }, []);
  const session = useSession();

  // Age state & detection
  const [age, setAge] = useState<number | "">("");

  // Neighborhoods state (up to 5)
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  // The member's own (approximate) location: GPS / map pin + area name
  const [myLocation, setMyLocation] = useState<MyLocation>({ name: "", lat: null, lng: null });

  // Skills & Needs states
  const [skills, setSkills] = useState<string[]>([]);

  const [servicesNeeded, setServicesNeeded] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  // Profile Picture state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (session) {
      reset({
        fullName: session.fullName,
        email: session.email,
        bio: session.bio,
        location: session.location,
        availability: session.availability || "Flexible",
        contactMethod: session.contactMethod,
        phone: session.phone ?? "",
        interests: session.interests,
        skills: session.skills,
        servicesOffered: session.servicesOffered,
        servicesNeeded: session.servicesNeeded,
      });

      if (session.age) setAge(session.age);
      setMyLocation({ name: session.location || "", lat: session.lat ?? null, lng: session.lng ?? null });
      if (session.neighborhoods && session.neighborhoods.length > 0) {
        setNeighborhoods(session.neighborhoods);
      } else if (session.location) {
        setNeighborhoods([session.location]);
      }
      setSkills(session.skills || []);
      setServicesNeeded(session.servicesNeeded || []);
      setInterests(session.interests || []);
      if (session.avatarUrl) setAvatarPreview(session.avatarUrl);
    }
  }, [session, reset]);

  const contactMethod = watch("contactMethod");
  const availability = watch("availability") || "Flexible";

  // Automatic Generation Detection
  const detectedGroup = useMemo(() => {
    const num = Number(age);
    if (!num || num < MIN_AGE || num > 120) return null;
    return detectGeneration(num);
  }, [age]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Please choose an image under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
        setAvatarPreview(compressedDataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (values: ProfileValues) => {
    setError(null);
    // The member's own area is their primary location and also counts as a neighbourhood
    const areaName = myLocation.name.trim();
    const finalNeighborhoods =
      areaName && !neighborhoods.includes(areaName) && neighborhoods.length < 5 ? [areaName, ...neighborhoods] : neighborhoods;
    if (finalNeighborhoods.length === 0) {
      setError("Please set your location or add at least one neighborhood.");
      return;
    }

    setSaving(true);
    try {
      const numericAge = typeof age === "number" ? age : Number(age) || null;
      await updateProfile({
        fullName: values.fullName,
        email: values.email || session?.email,
        age: numericAge,
        neighborhoods: finalNeighborhoods,
        location: areaName || finalNeighborhoods[0] || values.location || session?.location || "",
        lat: myLocation.lat,
        lng: myLocation.lng,
        bio: values.bio || "",
        availability: values.availability || "Flexible",
        contactMethod: values.contactMethod,
        phone: values.contactMethod === "phone" ? values.phone : null,
        skills,
        servicesOffered: skills,
        servicesNeeded,
        interests,
        avatarUrl: avatarPreview,
      });
      // Return to where the member came from (e.g. the post form), internal paths only
      const next = new URLSearchParams(window.location.search).get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.push(safeNext ?? `/profile/${session?.id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (msg?: string) =>
    msg ? <p className="text-xs text-destructive font-medium">{msg}</p> : null;

  return (
    <AuthGuard>
      <div className="page-container py-6 sm:py-10">
        {/* Page heading */}
        <div className="mx-auto max-w-5xl mb-6 sm:mb-8 animate-fade-up">
          <button
            type="button"
            onClick={() => router.back()}
            className="group mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to profile
          </button>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight">Edit Your Profile</h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            Update your biography, age, neighborhoods, and skills
          </p>

          {/* Came here from the "complete your profile" prompt */}
          {returningToPost && !completion.complete && (
            <div role="status" className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-bold">Finish these to create your post:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {completion.missing.map((m) => (
                  <li key={m.id}>{m.label}</li>
                ))}
              </ul>
              <p className="mt-2 text-amber-900/80">After you press Save Profile, we&apos;ll take you straight back.</p>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit(onSubmit, (formErrors) => {
            const firstErr = Object.values(formErrors)[0]?.message;
            if (firstErr) setError(firstErr);
          })}
          className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-6 lg:gap-8 items-start"
        >
          {/* ---------- Sidebar: avatar ---------- */}
          <aside className="lg:sticky lg:top-24 rounded-2xl border-2 border-border bg-card p-5 sm:p-6 shadow-sm">
            <div className="flex flex-row lg:flex-col items-center gap-4 lg:gap-5 lg:text-center">
              <div className="group relative shrink-0">
                <div className="h-20 w-20 sm:h-24 sm:w-24 lg:h-32 lg:w-32 rounded-full border-4 border-card ring-2 ring-border bg-secondary text-secondary-foreground flex items-center justify-center text-2xl lg:text-4xl font-bold overflow-hidden shadow-soft">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Profile picture" className="h-full w-full object-cover" />
                  ) : (
                    initials(session?.fullName || "User")
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={avatarPreview ? "Change photo" : "Upload photo"}
                >
                  <Camera className="h-6 w-6" />
                </button>
              </div>

              <div className="min-w-0 flex-1 lg:flex-none space-y-2">
                <p className="font-bold text-foreground truncate">{session?.fullName}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div className="flex flex-wrap lg:justify-center items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5 font-bold"
                  >
                    <Camera className="h-4 w-4" />
                    <span>{avatarPreview ? "Change" : "Upload"}</span>
                  </Button>
                  {avatarPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAvatar}
                      className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Remove</span>
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">PNG, JPG, or WEBP up to 5MB. Resized automatically.</p>
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Security</p>
              <Link
                href="/change-password"
                className="group flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <span className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Change password
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </aside>

          {/* ---------- Main form ---------- */}
          <div className="space-y-5 sm:space-y-6 min-w-0">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Basics */}
            <FormSection icon={User} title="About you">
              <div className="space-y-1.5">
                <label htmlFor="pe-name" className="text-sm font-bold text-foreground">
                  Full Name
                </label>
                <Input id="pe-name" autoComplete="name" {...register("fullName")} aria-invalid={Boolean(errors.fullName)} />
                {fieldError(errors.fullName?.message)}
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <label htmlFor="pe-age" className="text-sm font-bold text-foreground">
                    Your Age
                  </label>
                  <span className="text-xs text-muted-foreground">Automatically sets age group</span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Input
                    id="pe-age"
                    type="number"
                    inputMode="numeric"
                    min={MIN_AGE}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Enter your age"
                    className="sm:w-40"
                  />
                  <AgeGroupBadge group={detectedGroup} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="pe-bio" className="text-sm font-bold text-foreground">
                  Short Biography
                </label>
                <Textarea
                  id="pe-bio"
                  rows={4}
                  placeholder="Tell neighbors a little about your life, what you enjoy doing, and what you'd like to share..."
                  {...register("bio")}
                  aria-invalid={Boolean(errors.bio)}
                />
                {fieldError(errors.bio?.message)}
              </div>
            </FormSection>

            {/* Location */}
            <FormSection icon={MapPin} title="Location">
              <MyLocationPicker value={myLocation} onChange={setMyLocation} />
              <TagPicker
                label="Your Neighborhoods"
                description="Select neighborhoods you live in or frequently connect with"
                icon={MapPin}
                values={neighborhoods}
                onChange={(next) => {
                  setNeighborhoods(next);
                  setError(null);
                }}
                suggestions={POPULAR_NEIGHBORHOODS}
                max={5}
                onLimit={setError}
                placeholder="Search neighborhood (e.g. Urakami, Peace Park)..."
                quickPickLabel="Quick pick:"
                emptyText="No neighborhoods selected yet. Add at least one below."
                suggestionIcon={MapPin}
                formatQuickPick={(p) => p.split(",")[0]}
              />
            </FormSection>

            {/* Contact */}
            <FormSection icon={MessageSquare} title="Preferred Contact Method">
              <div role="radiogroup" aria-label="Preferred contact method" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    { value: "chat", icon: MessageSquare, label: "In-App Chat Only" },
                    { value: "phone", icon: Phone, label: "Allow Phone Contact" },
                  ] as const
                ).map(({ value, icon: OptIcon, label }) => {
                  const selected = contactMethod === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setValue("contactMethod", value)}
                      className={`flex items-center gap-2.5 p-3.5 rounded-xl border-2 text-left font-bold text-sm transition-all duration-200 ${
                        selected
                          ? "border-primary bg-primary/5 text-primary shadow-soft"
                          : "border-border bg-background text-foreground hover:border-primary/30 hover:bg-muted/60"
                      }`}
                    >
                      <OptIcon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{label}</span>
                      {selected && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {contactMethod === "phone" && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                  <label htmlFor="pe-phone" className="text-sm font-bold text-foreground">
                    Phone Number <span className="font-normal text-muted-foreground">(shared only on accepted exchanges)</span>
                  </label>
                  <Input
                    id="pe-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="e.g. 095-822-1004"
                    {...register("phone")}
                    aria-invalid={Boolean(errors.phone)}
                  />
                  {fieldError(errors.phone?.message)}
                </div>
              )}
            </FormSection>

            {/* Availability */}
            <FormSection icon={CalendarClock} title="Availability">
              <p className="-mt-2 text-sm text-muted-foreground">When are you usually free to meet or help?</p>
              <AvailabilityPicker
                idPrefix="pe-avail"
                value={availability}
                onChange={(next) => setValue("availability", next, { shouldDirty: true })}
              />
            </FormSection>

            {/* Interests */}
            <FormSection icon={Heart} title="Interests">
              <TagPicker
                label="Your interests"
                description="Hobbies and topics you enjoy — helps neighbours find common ground"
                icon={Heart}
                values={interests}
                onChange={setInterests}
                suggestions={SUGGESTED_INTERESTS}
                max={12}
                onLimit={setError}
                placeholder="Search an interest (e.g. Gardening, Music)..."
                addLabel="Add Interest"
                emptyText="No interests added yet."
              />
            </FormSection>

            {/* Skills & needs */}
            <FormSection icon={BookOpen} title="Skills & needs">
              <TagPicker
                label="Skills provided"
                icon={BookOpen}
                values={skills}
                onChange={setSkills}
                suggestions={SUGGESTED_SKILLS}
                max={10}
                onLimit={setError}
                placeholder="Search a skill (e.g. Origami, Tech help)..."
                addLabel="Add Skill"
                emptyText="No skills added yet."
              />
              <div className="border-t border-border/70 pt-5">
                <TagPicker
                  label="Services needed"
                  icon={HelpCircle}
                  iconClassName="text-secondary"
                  values={servicesNeeded}
                  onChange={setServicesNeeded}
                  suggestions={SUGGESTED_SERVICES}
                  max={10}
                  onLimit={setError}
                  placeholder="Search a need (e.g. Smartphone Assistance)..."
                  addLabel="Add Need"
                  emptyText="No services listed yet."
                />
              </div>
            </FormSection>

            {/* Actions */}
            <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card/95 backdrop-blur-md p-3 sm:p-4 shadow-lift">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" className="font-bold flex-1 sm:flex-none sm:px-8" disabled={saving}>
                {saving ? (
                  <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{saving ? "Saving..." : "Save Profile"}</span>
              </Button>
            </div>
          </div>
        </form>

        {session && (
          <div className="pt-2">
            <ProfileVerificationSection session={session} />
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border-2 border-border bg-card p-5 sm:p-6 shadow-sm space-y-5 transition-shadow duration-300 hover:shadow-soft">
      <h2 className="flex items-center gap-2.5 text-base sm:text-lg font-extrabold text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
