"use client";

import Link from "next/link";
import { useState, memo } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, ArrowRight, Send, MessageCircle, CheckCircle2, Flag } from "lucide-react";
import type { Post } from "@/lib/types";
import { usePublicProfile } from "@/lib/services/profileService";
import { useSession } from "@/lib/services/authService";
import { respondToPost } from "@/lib/services/requestService";
import { initials } from "@/lib/utils";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { ExchangeBadge, PostTypeBadge, POST_TYPE_ACCENT } from "@/components/posts/PostBadges";
import { ReportDialog } from "@/components/common/ReportDialog";
import { PostStatusBadge } from "@/components/common/StatusBadge";
import { timeAgo } from "@/components/notifications/notificationStyles";

/** "just now", "5m ago", "2d ago", or a date for older posts. */
function postedAgo(iso: string) {
  const t = timeAgo(iso);
  if (t === "now") return "just now";
  return /^\d+[mhd]$/.test(t) ? `${t} ago` : t;
}

export const PostCard = memo(function PostCard({ post, showStatus = false }: { post: Post; showStatus?: boolean }) {
  const author = usePublicProfile(post.authorId);
  const session = useSession();

  const [respondOpen, setRespondOpen] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const router = useRouter();

  const isOwner = session?.id === post.authorId;

  const handleQuickRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      window.location.href = "/login";
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await respondToPost(post.id, responseMessage);
      setSentSuccess(true);
      setTimeout(() => {
        setRespondOpen(false);
        setSentSuccess(false);
        setResponseMessage("");
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="group/card card-hover flex flex-col border-2 border-border bg-card rounded-2xl overflow-hidden w-full h-full">
      {/* Accent bar reflects the post type */}
      <div className={`h-1.5 w-full ${POST_TYPE_ACCENT[post.postType] ?? POST_TYPE_ACCENT.request}`} />

      <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <PostTypeBadge type={post.postType} />
            <Badge variant="outline" className="text-[11px] sm:text-xs font-semibold bg-muted/60 text-foreground border-border py-0.5 px-2.5">
              {post.category}
            </Badge>
          </div>
          {showStatus && (
            <span className="shrink-0">
              <PostStatusBadge status={post.status} />
            </span>
          )}
          {!isOwner && !showStatus && (
            <button
              type="button"
              onClick={() => (session ? setReportOpen(true) : router.push("/login"))}
              className="-mr-1.5 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Report post: ${post.title}`}
              title="Report this post"
            >
              <Flag className="h-4 w-4" />
            </button>
          )}
        </div>

        <Link href={`/posts/${post.id}`} className="block">
          <h3 className="font-extrabold text-lg sm:text-xl text-foreground group-hover/card:text-primary transition-colors duration-200 leading-snug line-clamp-2">
            {post.title}
          </h3>
        </Link>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-0 sm:pt-0 space-y-3 flex-1">
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{post.description}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 border-t border-border/70 text-xs text-muted-foreground">
          <span className="inline-flex min-w-0 max-w-full items-center gap-1 font-semibold text-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{post.location}</span>
          </span>
          <span className="inline-flex items-center gap-1 font-medium">
            <Clock className="h-3.5 w-3.5 text-secondary shrink-0" />
            <span>{post.availability}</span>
          </span>
          <ExchangeBadge method={post.exchangeMethod} amount={post.amount} />
        </div>
      </CardContent>

      <CardFooter className="p-4 sm:p-5 pt-3 sm:pt-3 border-t border-border/70 mt-auto flex flex-col gap-3">
        {author ? (
          <Link href={`/profile/${author.id}`} className="group/author flex w-full min-w-0 items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-bold ring-2 ring-card shadow-xs shrink-0 overflow-hidden transition-transform duration-200 group-hover/author:scale-105">
              {author.avatarUrl ? (
                <img src={author.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                initials(author.fullName)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 min-w-0">
                <p className="truncate text-sm font-bold text-foreground transition-colors group-hover/author:text-primary">
                  {author.fullName}
                </p>
                <VerifiedBadge status={author.verificationStatus} compact />
              </div>
              <p className="truncate text-[11px] font-medium text-muted-foreground">
                {author.userGroup === "og" ? "Older Generation" : "Younger Generation"} · {postedAgo(post.createdAt)}
              </p>
            </div>
          </Link>
        ) : (
          <p className="w-full text-xs text-muted-foreground">Neighbor in Nagasaki · {postedAgo(post.createdAt)}</p>
        )}

        <div className={`grid w-full gap-2 ${isOwner ? "grid-cols-1" : "grid-cols-2"}`}>
          {!isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRespondOpen((v) => !v)}
              aria-expanded={respondOpen}
              className={`font-semibold gap-1.5 px-3 ${respondOpen ? "border-primary/50 bg-primary/5" : ""}`}
            >
              <MessageCircle className="h-4 w-4 text-primary shrink-0" />
              Respond
            </Button>
          )}
          <Button asChild size="sm" className="group/view font-bold gap-1.5 px-3">
            <Link href={`/posts/${post.id}`}>
              {isOwner ? "View your post" : "View"}
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover/view:translate-x-0.5" />
            </Link>
          </Button>
        </div>

        {/* Inline response drawer */}
        {respondOpen && (
          <form
            onSubmit={handleQuickRespond}
            className="w-full pt-3 border-t border-border/60 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {sentSuccess ? (
              <div role="status" className="flex items-center gap-2 text-sm font-bold text-success bg-success/10 p-3 rounded-lg border border-success/30">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Response sent! Post owner will review your request.
              </div>
            ) : (
              <>
                <label htmlFor={`respond-${post.id}`} className="text-xs font-bold text-foreground block">
                  Send a response to {author?.fullName || "the author"}:
                </label>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="flex items-center gap-2">
                  <input
                    id={`respond-${post.id}`}
                    type="text"
                    value={responseMessage}
                    onChange={(e) => setResponseMessage(e.target.value)}
                    placeholder="Write a friendly note..."
                    className="flex-1 min-w-0 min-h-[40px] rounded-lg border-2 border-border bg-background px-3 text-sm text-foreground transition-colors hover:border-primary/40 focus:outline-none focus:border-primary"
                    required
                    autoFocus
                  />
                  <Button type="submit" size="sm" disabled={submitting} className="font-bold shrink-0 gap-1.5" aria-label="Send response">
                    {submitting ? (
                      <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span className="hidden min-[400px]:inline">Send</span>
                  </Button>
                </div>
              </>
            )}
          </form>
        )}
      </CardFooter>
      {reportOpen && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetType="post"
          targetId={post.id}
          targetLabel={`“${post.title}”`}
        />
      )}
    </Card>
  );
});
