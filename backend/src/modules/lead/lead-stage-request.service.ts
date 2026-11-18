import { query, run, transaction } from "../../database/db.js";
import { LeadServiceError, writeAudit, findLeadById } from "./lead.service.js";
import { isBackwardMove, isLeadStatus } from "./lead-status.js";

export const STAGE_REQUEST_STATUSES = ["Chờ duyệt", "Đã duyệt", "Từ chối"] as const;
export type StageRequestStatus = (typeof STAGE_REQUEST_STATUSES)[number];

const PENDING: StageRequestStatus = "Chờ duyệt";

export interface StageRequestDto {
  id: string;
  leadId: string;
  customerName: string;
  phone: string;
  staffName: string;
  /** Trạng thái hiện tại của Lead (có thể đã khác `fromStatus` nếu Lead được cập nhật sau khi gửi yêu cầu). */
  currentStatus: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  requestedBy: string;
  status: StageRequestStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string | null;
}

interface StageRequestRow {
  id: string;
  lead_id: string;
  customer_name: string;
  phone: string;
  staff_name: string;
  current_status: string;
  from_status: string;
  to_status: string;
  reason: string;
  requested_by: string;
  status: StageRequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string | null;
}

const REQUEST_SELECT = `SELECT r.id, r.lead_id, l.customer_name, l.phone, l.staff_name, l.status AS current_status,
    r.from_status, r.to_status, r.reason, r.requested_by, r.status, r.decided_by, r.decided_at,
    r.decision_note, r.created_at
  FROM lead_stage_requests r
  JOIN leads l ON l.id = r.lead_id`;

function toDto(row: StageRequestRow): StageRequestDto {
  return {
    id: row.id,
    leadId: row.lead_id,
    customerName: row.customer_name,
    phone: row.phone,
    staffName: row.staff_name,
    currentStatus: row.current_status,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reason: row.reason,
    requestedBy: row.requested_by,
    status: row.status,
    decidedBy: row.decided_by ?? null,
    decidedAt: row.decided_at ?? null,
    decisionNote: row.decision_note ?? null,
    createdAt: row.created_at ?? null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

export class LeadStageRequestService {
  async getById(id: string): Promise<StageRequestDto | null> {
    const rows = await query<StageRequestRow>(`${REQUEST_SELECT} WHERE r.id = ?`, [id]);
    return rows.length ? toDto(rows[0]) : null;
  }

  /** Nhân viên gửi yêu cầu quay lại bước trước (chỉ khi thật sự là lùi bước). */
  async create(leadId: string, toStatus: unknown, reason: unknown, requestedBy: string): Promise<StageRequestDto> {
    if (!isLeadStatus(toStatus)) {
      throw new LeadServiceError("Trạng thái muốn quay lại không hợp lệ", 400);
    }
    const reasonText = typeof reason === "string" ? reason.trim() : "";
    if (!reasonText) {
      throw new LeadServiceError("Vui lòng nhập lý do cần quay lại bước trước", 400);
    }
    if (reasonText.length > 500) {
      throw new LeadServiceError("Lý do tối đa 500 ký tự", 400);
    }

    const lead = await findLeadById(leadId);
    if (!lead) {
      throw new LeadServiceError("Không tìm thấy Lead", 404);
    }
    if (!isBackwardMove(lead.status, toStatus)) {
      throw new LeadServiceError(
        "Chuyển sang trạng thái này không phải quay lại bước trước, hãy cập nhật trạng thái trực tiếp",
        400
      );
    }

    const id = `LSR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      await run(
        `INSERT INTO lead_stage_requests
          (id, lead_id, from_status, to_status, reason, requested_by, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, leadId, lead.status, toStatus, reasonText, requestedBy, PENDING, new Date().toISOString()]
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new LeadServiceError("Lead này đã có yêu cầu quay lại bước đang chờ Admin duyệt", 409);
      }
      throw error;
    }

    await writeAudit(
      requestedBy,
      "Yêu cầu lùi bước Lead",
      `Lead ${leadId} (${lead.customerName}): ${lead.status} -> ${toStatus}. Lý do: ${reasonText}`
    );
    return (await this.getById(id))!;
  }

  /** Admin xem danh sách yêu cầu (mặc định mọi trạng thái, mới nhất trước). */
  async list(status?: unknown): Promise<StageRequestDto[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (status !== undefined && status !== "") {
      if (!(STAGE_REQUEST_STATUSES as readonly unknown[]).includes(status)) {
        throw new LeadServiceError("Trạng thái yêu cầu không hợp lệ", 400);
      }
      where.push("r.status = ?");
      params.push(status);
    }
    const rows = await query<StageRequestRow>(
      `${REQUEST_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY r.created_at DESC, r.id DESC`,
      params
    );
    return rows.map(toDto);
  }

  /** Admin duyệt (áp dụng đổi trạng thái trong cùng transaction) hoặc từ chối. */
  async decide(id: string, action: unknown, note: unknown, adminName: string): Promise<StageRequestDto> {
    if (action !== "approve" && action !== "reject") {
      throw new LeadServiceError("Hành động phải là approve hoặc reject", 400);
    }
    const noteText = typeof note === "string" ? note.trim() : "";
    if (noteText.length > 500) {
      throw new LeadServiceError("Ghi chú tối đa 500 ký tự", 400);
    }

    const outcome = await transaction(async (tx) => {
      const rows = await tx.query<{
        id: string;
        lead_id: string;
        from_status: string;
        to_status: string;
        status: string;
      }>("SELECT id, lead_id, from_status, to_status, status FROM lead_stage_requests WHERE id = ? FOR UPDATE", [id]);
      if (!rows.length) {
        throw new LeadServiceError("Không tìm thấy yêu cầu", 404);
      }
      const req = rows[0];
      if (req.status !== PENDING) {
        throw new LeadServiceError(`Yêu cầu này đã được xử lý (${req.status})`, 409);
      }

      const nextStatus: StageRequestStatus = action === "approve" ? "Đã duyệt" : "Từ chối";
      if (action === "approve") {
        const updated = await tx.run(
          "UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [req.to_status, req.lead_id]
        );
        if (updated.changes === 0) {
          throw new LeadServiceError("Không tìm thấy Lead", 404);
        }
      }
      await tx.run(
        `UPDATE lead_stage_requests
         SET status = ?, decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ?`,
        [nextStatus, adminName, new Date().toISOString(), noteText || null, id]
      );
      return { leadId: req.lead_id, toStatus: req.to_status, fromStatus: req.from_status, nextStatus };
    });

    await writeAudit(
      adminName,
      outcome.nextStatus === "Đã duyệt" ? "Duyệt yêu cầu lùi bước Lead" : "Từ chối yêu cầu lùi bước Lead",
      `Lead ${outcome.leadId}: ${outcome.fromStatus} -> ${outcome.toStatus}${noteText ? `. Ghi chú: ${noteText}` : ""}`
    );
    return (await this.getById(id))!;
  }
}
