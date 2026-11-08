import { api } from "./client";
import type { ReportReason, ReportTarget } from "./reports";

export type AdminReport = {
  id: string;
  created_at: string;
  reason: ReportReason;
  details: string | null;
  status: "open" | "resolved";
  reporter_id: string;
  reporter_username: string | null;
  target_type: ReportTarget;
  target_id: string;
  target_label: string | null; // null once the target has been deleted
  target_kind: "event" | "community" | null;
  target_report_count: number;
};

export function listAdminReports(status: "open" | "resolved"): Promise<AdminReport[]> {
  return api.authed(`/admin/reports?status=${status}`);
}

export function setReportStatus(id: string, status: "open" | "resolved"): Promise<AdminReport> {
  return api.authed(`/admin/reports/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
}
