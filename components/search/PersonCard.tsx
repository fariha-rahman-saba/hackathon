"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Send, AlertCircle, CheckCircle2, MessageSquare } from "lucide-react";
import type { Profile } from "@/lib/types";
import { usePublicProfile } from "@/lib/services/profileService";
import { createDirectRequest, useRequestBetween } from "@/lib/services/requestService";
import { useSession } from "@/lib/services/authService";
import { groupShort } from "@/lib/constants";
import { initials } from "@/lib/utils";
import { RatingStars } from "@/components/common/RatingStars";
import { RequestStatusBadge } from "@/components/common/StatusBadge";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { ConnectionButton } from "@/components/connections/ConnectionButton";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";

export function PersonCard({ person }: { person: Profile }) {
  const session = useSession();
  const router = useRouter();
  const publicData = usePublicProfile(person.id);
  const existingRequest = useRequestBetween(person.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      router.push("/login");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await createDirectRequest(person.id, message);
      setSentSuccess(true);
      setTimeout(() => {
        setModalOpen(false);
        setSentSuccess(false);
        setMessage("");
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to send request.");
    } finally {
      setSending(false);
    }
  };

  const isMe = session?.id === person.id;

  return (
    <>
      <Card className="group/card card-hover flex flex-col h-full border-2 border-border bg-[#fffdfa] rounded-2xl overflow-hidden">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-start gap-4">
            <Link
              href={`/profile/${person.id}`}
              className="h-14 w-14 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-lg font-bold ring-2 ring-card shadow-soft shrink-0 overflow-hidden transition-transform duration-300 group-hover/card:scale-105"
              aria-label={`View ${person.fullName}'s profile`}
            >
              {person.avatarUrl ? (
                <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                initials(person.fullName)
              )}
            </Link>

            <div className="space-y-1.5 min-w-0 flex-1">
              <Link href={`/profile/${person.id}`} className="flex items-center gap-1.5 min-w-0">
                <h3 className="font-bold text-lg sm:text-xl text-foreground group-hover/card:text-primary transition-colors truncate">
                  {person.fullName}
                </h3>
                <VerifiedBadge status={person.verificationStatus} compact />
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                    person.userGroup === "og" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {groupShort(person.userGroup)}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{person.location || "Local"}</span>
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0 sm:pt-0 space-y-4 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs py-2 px-3 rounded-lg bg-muted/60 border border-border/60">
            <RatingStars rating={publicData?.averageRating ?? null} count={publicData?.reviewCount} size="sm" />
            <span className="font-semibold text-foreground tabular-nums">{publicData?.completedCount ?? 0} completed</span>
          </div>

          {person.bio && <p className="text-sm text-muted-foreground line-clamp-2 italic">“{person.bio}”</p>}

          {person.skills.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Expertise & Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {person.skills.slice(0, 4).map((skill) => (
                  <span key={skill} className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-muted text-foreground text-xs font-semibold">
                    {skill}
                  </span>
                ))}
                {person.skills.length > 4 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-muted-foreground">
                    +{person.skills.length - 4} more
                  </span>
                )}
              </div>
            </div>
          )}

          {person.availability && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-secondary shrink-0" />
              <span>Available: {person.availability}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-4 sm:p-5 pt-3 sm:pt-3 border-t border-border/60 mt-auto flex flex-wrap items-center justify-between gap-2">
          <Button asChild variant="outline" size="sm" className={`font-semibold ${isMe ? "w-full" : "flex-1"}`}>
            <Link href={`/profile/${person.id}`}>Profile</Link>
          </Button>
          {!isMe && <ConnectionButton userId={person.id} size="sm" className="flex-1 [&>*]:w-full" />}

          {!isMe &&
            (existingRequest ? (
              <div className="flex flex-1 items-center gap-1.5 flex-wrap justify-end">
                <RequestStatusBadge status={existingRequest.status} />
                {existingRequest.status === "accepted" && (
                  <Button asChild size="sm" className="gap-1.5">
                    <Link href="/chat">
                      <MessageSquare className="h-4 w-4" />
                      Chat
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => (session ? setModalOpen(true) : router.push("/login"))}
                className="flex-1 font-bold gap-1.5"
              >
                <Send className="h-4 w-4 shrink-0" />
                Ask for help
              </Button>
            ))}
        </CardFooter>
      </Card>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => !sending && setModalOpen(open)}
        title={`Ask ${person.fullName} for help`}
        description="Ask about learning from their expertise or propose a skill exchange."
        className="sm:max-w-lg"
      >
        {error && (
          <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {sentSuccess && (
          <div role="status" className="mb-3 flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success font-semibold animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Request sent successfully!
          </div>
        )}

        <form onSubmit={handleSendRequest} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={`connect-${person.id}`} className="text-sm font-semibold text-foreground">
              Your message or proposal:
            </label>
            <Textarea
              id={`connect-${person.id}`}
              rows={4}
              placeholder={`Hi ${person.fullName}, I noticed your expertise and would love to connect...`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={280}
              required
            />
            <span className="block text-right text-xs text-muted-foreground tabular-nums">{message.length}/280</span>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button type="submit" disabled={sending || sentSuccess} className="font-bold">
              {sending ? (
                <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
