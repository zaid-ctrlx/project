import { api } from "./client";

export type ReportTarget = "user" | "event";
export type ReportReason = "spam" | "harassment" | "inappropriate" | "fake" | "unsafe" | "other";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or scam",
  harassment: "Harassment or bullying",
  inappropriate: "Inappropriate content",
  fake: "Fake or misleading",
  unsafe: "Unsafe or dangerous",
  other: "Something else",
};

export function submitReport(
  targetType: ReportTarget,
  targetId: string,
  reason: ReportReason,
  details?: string
): Promise<{ result: "created" | "already_reported" }> {
  return api.authed("/reports", {
    method: "POST",
    body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, details: details?.trim() || null }),
  });
}
