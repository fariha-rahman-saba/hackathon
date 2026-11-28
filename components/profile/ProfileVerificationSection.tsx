"use client";

import { useRef, useState } from "react";
import {
  BadgeCheck,
  Clock,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Upload,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { Profile, VerificationDocType } from "@/lib/types";
import {
  prepareVerificationDocument,
  submitVerificationRequest,
  useMyVerificationRequest,
} from "@/lib/services/verificationService";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

const DOC_TYPES: Array<{ value: VerificationDocType; label: string }> = [
  { value: "national_id", label: "National ID / My Number Card" },
  { value: "passport", label: "Passport" },
  { value: "senior_card", label: "Senior Citizen / Pension Card" },
  { value: "student_id", label: "Student / University ID" },
  { value: "other", label: "Other Official Community Document" },
];

export function ProfileVerificationSection({ session }: { session: Profile }) {
  const latestRequest = useMyVerificationRequest(session.id);
  const fileRef = useRef<HTMLInputElement>(null);

  const [docType, setDocType] = useState<VerificationDocType>("national_id");
  const [docUrl, setDocUrl] = useState<string>("");
  const [docName, setDocName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const status = session.verificationStatus ?? (latestRequest?.status === "approved" ? "verified" : latestRequest?.status === "pending" ? "pending" : latestRequest?.status === "rejected" ? "rejected" : "unverified");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setUploading(true);
    try {
      const prepared = await prepareVerificationDocument(file);
      setDocUrl(prepared);
      setDocName(file.name);
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Failed to load document." });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setFeedback(null);
    if (!docUrl) {
      setFeedback({ type: "err", text: "Please select or upload a document image or PDF first." });
      return;
    }
    setSubmitting(true);
    try {
      await submitVerificationRequest({
        documentType: docType,
        documentUrl: docUrl,
        documentName: docName || "verification-document",
        notes,
      });
      setDocUrl("");
      setDocName("");
      setNotes("");
      setFeedback({
        type: "ok",
        text: "Your verification documents have been submitted! An administrator will review them shortly.",
      });
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Failed to submit verification request." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="verify-profile"
      className="rounded-2xl border-2 border-border bg-card p-5 sm:p-6 shadow-sm space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-base sm:text-lg font-extrabold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
          </span>
          Profile Verification
        </h2>

        {status === "verified" && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <BadgeCheck className="h-4 w-4 text-emerald-600" />
            Verified Profile
          </span>
        )}
        {status === "pending" && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <Clock className="h-4 w-4 text-amber-600" />
            Pending Admin Review
          </span>
        )}
        {status === "rejected" && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            Needs Re-submission
          </span>
        )}
      </div>

      {status === "verified" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-950 space-y-1">
            <p className="font-bold">Your profile is verified!</p>
            <p className="text-emerald-800">
              Neighbors can see the Verified badge on your profile and posts, helping build community trust.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Upload a clear photo or PDF of an official ID (National ID, Passport, Senior Citizen Card, or Student ID) so an administrator can verify your profile and grant you the <strong>Verified</strong> badge.
          </p>

          {status === "rejected" && latestRequest?.adminNotes && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-900 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Previous submission note:</p>
                <p>{latestRequest.adminNotes}</p>
              </div>
            </div>
          )}

          {status === "pending" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Documents submitted and waiting for review</p>
                <p>You can upload a replacement document below if needed.</p>
              </div>
            </div>
          )}

          {feedback && (
            <div
              className={`rounded-xl border p-3.5 text-sm font-medium flex items-center gap-2 ${
                feedback.type === "ok"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              {feedback.type === "ok" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="verification-doc-type" className="text-sm font-bold text-foreground">
                Document Type
              </label>
              <select
                id="verification-doc-type"
                value={docType}
                onChange={(e) => setDocType(e.target.value as VerificationDocType)}
                className="w-full h-11 px-3 rounded-lg border-2 border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:border-primary"
              >
                {DOC_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">Upload Document (Image or PDF)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full h-11 justify-start gap-2 border-2 border-dashed border-border hover:border-primary"
              >
                <Upload className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">
                  {uploading ? "Processing document..." : docName || "Choose ID image or PDF..."}
                </span>
              </Button>
            </div>
          </div>

          {docUrl && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-3">
              {docUrl.startsWith("data:image/") ? (
                <img
                  src={docUrl}
                  alt="Document preview"
                  className="h-16 w-24 object-cover rounded-lg border border-border shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileText className="h-7 w-7" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">{docName}</p>
                <p className="text-xs text-muted-foreground">Ready to submit for admin review</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDocUrl("");
                  setDocName("");
                }}
              >
                Remove
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="verification-notes" className="text-sm font-bold text-foreground">
              Notes for Admin (Optional)
            </label>
            <Textarea
              id="verification-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Front side of my Nagasaki resident card"
              maxLength={300}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || uploading || !docUrl}
              className="font-bold gap-2 bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{submitting ? "Submitting..." : "Submit for Verification"}</span>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
