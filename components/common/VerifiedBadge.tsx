import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VerificationStatus } from "@/lib/types";

interface VerifiedBadgeProps {
  status?: VerificationStatus;
  compact?: boolean;
  className?: string;
}

/**
 * Displays a Verified Profile badge when a member's documents have been approved by an admin.
 */
export function VerifiedBadge({ status, compact = false, className }: VerifiedBadgeProps) {
  if (status !== "verified") return null;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center text-emerald-600 shrink-0",
          className,
        )}
        title="Verified Profile"
        aria-label="Verified Profile"
      >
        <BadgeCheck className="h-4 w-4 fill-emerald-100 text-emerald-700" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shrink-0",
        className,
      )}
      title="Identity verified by Musubi Admin"
    >
      <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
      <span>Verified</span>
    </span>
  );
}
