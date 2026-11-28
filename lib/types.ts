/**
 * Domain types for Musubi.
 * Field names are camelCase in the app. supabase/schema.sql uses snake_case.
 * Phase 2 services should map between the two without changing these shapes
 * where a UI-facing type is noted.
 */

export type UserGroup = "og" | "yg";
export type ContactMethod = "chat" | "phone";
export type AgeGroup = "18-29" | "30-49" | "50-64" | "65+";
export type ExchangeMethod = "free" | "exchange" | "paid";
export type PostType = "offer" | "request";
export type PostStatus = "open" | "in_progress" | "completed" | "closed";
export type RequestStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed";
export type TransactionStatus = "pending" | "successful" | "failed";
export type ReportTarget = "post" | "user";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type VerificationDocType = "national_id" | "passport" | "student_id" | "senior_card" | "other";
export type ReportStatus =
  | "pending"
  | "resolved_deleted"
  | "resolved_warned"
  | "resolved_banned"
  | "dismissed_fake";

export type Category =
  | "Cooking"
  | "Technology"
  | "Arts & Crafts"
  | "Gardening"
  | "Daily Assistance"
  | "Companionship"
  | "Community & Local Activities";

/** profiles */
export interface Profile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  age?: number | null;
  ageGroup: AgeGroup | null;
  location: string;
  neighborhoods?: string[];
  lat: number | null;
  lng: number | null;
  bio: string;
  interests: string[];
  skills: string[];
  servicesOffered: string[];
  servicesNeeded: string[];
  availability: string;
  contactMethod: ContactMethod;
  phone: string | null;
  userGroup: UserGroup;
  isAdmin?: boolean;
  isBanned?: boolean;
  banReason?: string | null;
  warningsCount?: number;
  lastActiveAt?: string | null;
  verificationStatus?: VerificationStatus;
  verifiedAt?: string | null;
  createdAt: string;
}

/** Public profile. Email is never included. Phone is included only when allowed. */
export interface PublicProfile extends Omit<Profile, "email" | "phone"> {
  phone: string | null;
  phoneShared: boolean;
  averageRating: number | null;
  reviewCount: number;
  completedCount: number;
  age?: number | null;
  neighborhoods?: string[];
}

/** skills */
export interface Skill {
  id: string;
  userId: string;
  name: string;
}

/** needs */
export interface Need {
  id: string;
  userId: string;
  name: string;
}

/** posts */
export interface Post {
  id: string;
  authorId: string;
  title: string;
  description: string;
  category: Category;
  skill: string;
  location: string;
  lat: number | null;
  lng: number | null;
  availability: string;
  postType: PostType;
  exchangeMethod: ExchangeMethod;
  amount: number | null;
  status: PostStatus;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** requirement_templates — also declared in lib/templates.ts for Phase 1 */
export interface RequirementTemplate {
  id: string;
  category: Category;
  title: string;
  description: string;
  suggestedExchange: ExchangeMethod;
  skill: string;
  postType: PostType;
}

/** service_requests */
export interface ServiceRequest {
  id: string;
  postId: string | null;
  requesterId: string;
  ownerId: string;
  message: string;
  status: RequestStatus;
  direct: boolean;
  requesterDone: boolean;
  ownerDone: boolean;
  createdAt: string;
  updatedAt: string;
}

/** conversations */
export interface Conversation {
  id: string;
  requestId: string;
  participantIds: [string, string];
  createdAt: string;
}

/** messages */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  canned?: boolean;
}

/** notifications */
export type NotificationType =
  | "request_new"
  | "request_accepted"
  | "request_rejected"
  | "message"
  | "activity"
  | "completed"
  | "review"
  | "payment"
  | "connection_request"
  | "connection_accepted"
  | "direct_message"
  | "warning"
  | "verification_approved"
  | "verification_rejected";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
}

/** transactions */
export interface Transaction {
  id: string;
  requestId: string;
  postId: string | null;
  payerId: string;
  payeeId: string;
  amount: number;
  status: TransactionStatus;
  createdAt: string;
}

/** reviews */
export interface Review {
  id: string;
  activityId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

/** activities */
export interface Activity {
  id: string;
  requestId: string;
  postId: string | null;
  participantIds: [string, string];
  title: string;
  category: string;
  completedAt: string;
}

/** reports */
export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  status?: ReportStatus;
  resolutionNote?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

/** profile_verifications */
export interface VerificationRequest {
  id: string;
  userId: string;
  documentType: VerificationDocType;
  documentUrl: string;
  documentName: string;
  notes: string;
  status: "pending" | "approved" | "rejected";
  adminNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

/** user_warnings */
export interface UserWarning {
  id: string;
  userId: string;
  issuedBy: string;
  reason: string;
  reportId?: string | null;
  createdAt: string;
}

/** blocks — supports the block action; not a public profile field */
export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export interface SearchFilters {
  category: string;
  location: string;
  skill: string;
  exchangeMethod: string;
  availability: string;
  userGroup: string;
}

export interface SearchResult {
  posts: Post[];
  people: Profile[];
  /** True when no post matched, so people are the primary result. */
  preferPeople: boolean;
}

export interface AppState {
  users: Profile[];
  posts: Post[];
  requests: ServiceRequest[];
  conversations: Conversation[];
  messages: Message[];
  notifications: Notification[];
  transactions: Transaction[];
  reviews: Review[];
  activities: Activity[];
  reports: Report[];
  blocks: Block[];
  verificationRequests?: VerificationRequest[];
  warnings?: UserWarning[];
  /** conversationId -> user ids who confirmed the safety tips */
  safetyAck: Record<string, string[]>;
  sessionUserId: string | null;
}

/* -------------------------------------------------------------------------- */
/* Connections & direct messages                                              */
/* -------------------------------------------------------------------------- */

export type ConnectionStatus = "pending" | "accepted" | "rejected";

/** connections — a friend-style link between two members */
export interface Connection {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

/** dm_messages — messages between connected members (separate from post chats) */
export interface DirectMessage {
  id: string;
  connectionId: string;
  senderId: string;
  body: string | null;
  imagePath: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export const DM_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
export type DmReactionEmoji = (typeof DM_REACTIONS)[number];

/** dm_reactions — one reaction per member per message */
export interface DirectReaction {
  messageId: string;
  userId: string;
  emoji: DmReactionEmoji;
}
