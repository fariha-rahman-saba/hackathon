import {
  Activity,
  Bell,
  CheckCheck,
  CheckCircle2,
  Coins,
  Inbox,
  MessageSquare,
  Star,
  XCircle,
  UserPlus,
  UserCheck,
  MessageCircle,
  AlertTriangle,
  BadgeCheck,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import type { NotificationType } from "@/lib/types";

/** Icon + colour per notification type, shared by the page and the header panel. */
export const NOTIFICATION_STYLE: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  request_new: { icon: Inbox, className: "bg-blue-50 text-blue-700" },
  request_accepted: { icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700" },
  request_rejected: { icon: XCircle, className: "bg-rose-50 text-rose-700" },
  message: { icon: MessageSquare, className: "bg-[#E7EEE4] text-[#315B4B]" },
  activity: { icon: Activity, className: "bg-amber-50 text-amber-700" },
  completed: { icon: CheckCheck, className: "bg-emerald-50 text-emerald-700" },
  review: { icon: Star, className: "bg-amber-50 text-amber-600" },
  payment: { icon: Coins, className: "bg-blue-50 text-blue-700" },
  connection_request: { icon: UserPlus, className: "bg-violet-50 text-violet-700" },
  connection_accepted: { icon: UserCheck, className: "bg-emerald-50 text-emerald-700" },
  direct_message: { icon: MessageCircle, className: "bg-[#E7EEE4] text-[#315B4B]" },
  warning: { icon: AlertTriangle, className: "bg-amber-50 text-amber-700" },
  verification_approved: { icon: BadgeCheck, className: "bg-emerald-50 text-emerald-700" },
  verification_rejected: { icon: ShieldAlert, className: "bg-rose-50 text-rose-700" },
};

/** Notification types that represent chat messages (counted on chat badges, not the bell). */
export const CHAT_NOTIFICATION_TYPES: NotificationType[] = ["message", "direct_message"];

export function notificationStyle(type: NotificationType) {
  return NOTIFICATION_STYLE[type] ?? { icon: Bell, className: "bg-muted text-foreground" };
}

/** Facebook-style relative time ("now", "5m", "3h", "2d", then date). */
export function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(iso));
}
