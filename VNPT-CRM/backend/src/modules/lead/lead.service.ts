import { query, run } from "../../database/db.js";
import {
  ACTIVE_AM_ROLES,
  LEAD_CHANNELS,
  LEAD_GROUPS,
  RANDOM_STAFF_TOKEN,
  ROLES,
  UNASSIGNED_STAFF,
  USER_STATUS,
} from "../../constants/org.js";
import { ChannelSourceError, validateChannelDetail } from "../channel-source/channel-source.service.js";
import { BACKWARD_BLOCKED_MESSAGE, isBackwardMove, isLeadStatus } from "./lead-status.js";

export class LeadServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409
  ) {
    super(message);
  }
}

export interface LeadRow {
  id: string;
  customer_name: string;
  phone: string;
  group_name: string;
  channel: string;
  staff_name: string;
  status: string;
  expected_value: number;
  demand_description: string;
  territory_id: string | null;
  referred_by_ctv_id: string | null;
  referred_by_ctv_name: string | null;
  channel_source_id: string | null;
  channel_source_name: string | null;
  channel_source_kind: string | null;
  pending_request_id: string | null;
  pending_to_status: string | null;
  pending_reason: string | null;
  pending_requested_by: string | null;
  pending_created_at: string | null;
  note?: string | null;
  email?: string | null;
}

export interface PendingStageRequestDto {
  id: string;
  toStatus: string;
  reason: string;
  requestedBy: string;
  createdAt: string | null;
}

export interface LeadRecordDto {
  id: string;
  customerName: string;
  phone: string;
  email: string | null;
  group: string;
  channel: string;
  staffName: string;
  status: string;
  expectedValue: number;
  demandDescription: string;
  territoryId: string | null;
  referredByCtvId: string | null;
  referredByCtvName: string | null;
  channelSourceId: string | null;
  channelSourceName: string | null;
  channelSourceKind: string | null;
  note: string | null;
  /** Yêu cầu quay lại bước trước đang chờ Admin duyệt (nếu có). */
  pendingStageRequest: PendingStageRequestDto | null;
}

export interface CreateLeadInput {
  customerName: string;
  phone: string;
  /** Không bắt buộc nhập. */
  email?: string | null;
  group: string;
  channel: string;
  staffName: string;
  status?: string;
  expectedValue?: number;
  demandDescription?: string;
  territoryId?: string | null;
  referredByCtvId?: string | null;
  channelSourceId?: string | null;
  note?: string | null;
}

/** Thông tin chung Admin được sửa (PATCH /leads/:id). Trường nào không gửi thì giữ nguyên. */
export interface UpdateLeadInput {
  customerName?: unknown;
  phone?: unknown;
  email?: unknown;
  group?: unknown;
  channel?: unknown;
  channelSourceId?: unknown;
  referredByCtvId?: unknown;
  expectedValue?: unknown;
  demandDescription?: unknown;
  note?: unknown;
}

export interface LeadAssignmentInput {
  staffName?: string;
  territoryId?: string | null;
}

export interface LeadActor {
  isAdmin: boolean;
  name: string;
}

export interface CtvOptionDto {
  id: string;
  name: string;
  referralCode: string;
}

const DEFAULT_LEAD_STATUS = "Mới tiếp nhận";

export const LEAD_SELECT = `SELECT l.*, u.name AS referred_by_ctv_name,
    cs.name AS channel_source_name, cs.kind AS channel_source_kind,
    r.id AS pending_request_id, r.to_status AS pending_to_status, r.reason AS pending_reason,
    r.requested_by AS pending_requested_by, r.created_at AS pending_created_at
  FROM leads l
  LEFT JOIN users u ON u.id = l.referred_by_ctv_id
  LEFT JOIN channel_sources cs ON cs.id = l.channel_source_id
  LEFT JOIN lead_stage_requests r ON r.lead_id = l.id AND r.status = 'Chờ duyệt'`;

export async function writeAudit(user: string, action: string, details: string): Promise<void> {
  await run('INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)', [
    `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user,
    action,
    details,
  ]);
}

function toLeadRecord(row: LeadRow): LeadRecordDto {
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    email: row.email ?? null,
    group: row.group_name,
    channel: row.channel,
    staffName: row.staff_name,
    status: row.status,
    expectedValue: row.expected_value,
    demandDescription: row.demand_description,
    territoryId: row.territory_id ?? null,
    referredByCtvId: row.referred_by_ctv_id ?? null,
    referredByCtvName: row.referred_by_ctv_name ?? null,
    channelSourceId: row.channel_source_id ?? null,
    channelSourceName: row.channel_source_name ?? null,
    channelSourceKind: row.channel_source_kind ?? null,
    note: row.note ?? null,
    pendingStageRequest: row.pending_request_id
      ? {
          id: row.pending_request_id,
          toStatus: row.pending_to_status ?? "",
          reason: row.pending_reason ?? "",
          requestedBy: row.pending_requested_by ?? "",
          createdAt: row.pending_created_at ?? null,
        }
      : null,
  };
}

export async function findLeadById(id: string): Promise<LeadRecordDto | null> {
  const rows = await query<LeadRow>(`${LEAD_SELECT} WHERE l.id = ?`, [id]);
  return rows.length ? toLeadRecord(rows[0]) : null;
}

async function assertTerritoryExists(territoryId: string): Promise<void> {
  const rows = await query("SELECT id FROM territories WHERE id = ?", [territoryId]);
  if (!rows.length) {
    throw new LeadServiceError("Phường không tồn tại", 400);
  }
}

/** Chuyển lỗi kiểm tra "Chi tiết kênh" thành lỗi của Lead (cùng thông điệp, cùng mã). */
async function validateLeadChannelDetail(
  input: { channel: string; channelSourceId?: string | null; referredByCtvId?: string | null },
  options?: { keepInactiveSourceId?: string | null; keepCtvId?: string | null }
) {
  try {
    return await validateChannelDetail(input, options);
  } catch (error) {
    if (error instanceof ChannelSourceError) {
      throw new LeadServiceError(error.message, error.status === 403 ? 403 : error.status === 404 ? 404 : 400);
    }
    throw error;
  }
}

function parseExpectedValue(raw: unknown): number {
  const value = raw === undefined ? 0 : Number(raw);
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new LeadServiceError("Giá trị dự kiến phải là một số hợp lệ", 400);
  }
  if (value < 0) {
    throw new LeadServiceError("Giá trị dự kiến không được âm", 400);
  }
  return value;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email không bắt buộc nhập; nếu có nhập thì phải đúng định dạng. */
function parseEmail(raw: unknown): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new LeadServiceError("Email không hợp lệ", 400);
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    throw new LeadServiceError("Email không hợp lệ", 400);
  }
  return trimmed;
}

function parseNote(raw: unknown): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new LeadServiceError("Ghi chú phải là chuỗi", 400);
  }
  const trimmed = raw.trim();
  if (trimmed.length > 1000) {
    throw new LeadServiceError("Ghi chú tối đa 1000 ký tự", 400);
  }
  return trimmed.length > 0 ? trimmed : null;
}

export interface LeadServiceOptions {
  random?: () => number;
}

export class LeadService {
  private readonly random: () => number;

  constructor(options?: LeadServiceOptions) {
    this.random = options?.random ?? Math.random;
  }

  /** `ownerName` có giá trị: chỉ trả Lead do nhân viên đó phụ trách. */
  async getAll(ownerName?: string): Promise<LeadRecordDto[]> {
    const rows =
      ownerName === undefined
        ? await query<LeadRow>(`${LEAD_SELECT} ORDER BY l.created_at DESC`)
        : await query<LeadRow>(`${LEAD_SELECT} WHERE l.staff_name = ? ORDER BY l.created_at DESC`, [ownerName]);
    return rows.map(toLeadRecord);
  }

  async getById(id: string): Promise<LeadRecordDto | null> {
    return findLeadById(id);
  }

  async getCtvOptions(): Promise<CtvOptionDto[]> {
    const rows = await query<{ id: string; name: string; referral_code: string | null }>(
      "SELECT id, name, referral_code FROM users WHERE role = ? AND status = ? ORDER BY name",
      [ROLES.CTV, USER_STATUS.ACTIVE]
    );
    return rows.map((r) => ({ id: r.id, name: r.name, referralCode: r.referral_code ?? "" }));
  }

  async create(data: CreateLeadInput): Promise<LeadRecordDto> {
    if (!data.customerName || !data.phone || !data.group || !data.channel || !data.staffName) {
      throw new LeadServiceError("Thiếu thông tin bắt buộc để tạo Lead", 400);
    }

    if (!(LEAD_CHANNELS as readonly string[]).includes(data.channel)) {
      throw new LeadServiceError("Kênh phát triển không hợp lệ", 400);
    }

    if (!(LEAD_GROUPS as readonly string[]).includes(data.group)) {
      throw new LeadServiceError("Nhóm cơ hội không hợp lệ", 400);
    }

    const expectedValue = parseExpectedValue(data.expectedValue);

    if (data.status !== undefined && !isLeadStatus(data.status)) {
      throw new LeadServiceError("Trạng thái không hợp lệ", 400);
    }

    let staffName = String(data.staffName).trim();
    if (!staffName) {
      throw new LeadServiceError("Thiếu thông tin bắt buộc để tạo Lead", 400);
    }

    if (staffName === RANDOM_STAFF_TOKEN) {
      const amRows = await query<{ name: string }>(
        `SELECT name FROM staff WHERE status = 'Đang hoạt động' AND role IN (?, ?) ORDER BY name`,
        [ACTIVE_AM_ROLES[0], ACTIVE_AM_ROLES[1]]
      );
      if (!amRows.length) {
        throw new LeadServiceError("Không có nhân viên AM đang hoạt động để chia ngẫu nhiên", 400);
      }
      const index = Math.floor(this.random() * amRows.length);
      staffName = amRows[index].name;
    } else if (staffName !== UNASSIGNED_STAFF) {
      const staffRows = await query<{ id: string }>("SELECT id FROM staff WHERE name = ?", [staffName]);
      if (!staffRows.length) {
        throw new LeadServiceError("Nhân viên không tồn tại", 400);
      }
    }

    const detail = await validateLeadChannelDetail({
      channel: data.channel,
      channelSourceId: data.channelSourceId,
      referredByCtvId: data.referredByCtvId,
    });

    const territoryId = data.territoryId ? String(data.territoryId) : null;
    if (territoryId) {
      await assertTerritoryExists(territoryId);
    }

    const note = parseNote(data.note);
    const email = parseEmail(data.email);

    const id = `LEAD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await run(
      `INSERT INTO leads (
        id, customer_name, phone, email, group_name, channel, staff_name,
        status, expected_value, demand_description, territory_id, referred_by_ctv_id, note, channel_source_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.customerName,
        data.phone,
        email,
        data.group,
        data.channel,
        staffName,
        data.status || DEFAULT_LEAD_STATUS,
        expectedValue,
        data.demandDescription || "",
        territoryId,
        detail.referredByCtvId,
        note,
        detail.channelSourceId,
      ]
    );

    return (await findLeadById(id))!;
  }

  /**
   * Admin sửa thông tin chung của Lead. Không đụng tới trạng thái, người phụ trách
   * và phường (đã có endpoint riêng). Chỉ validate "Chi tiết kênh" khi người dùng
   * thật sự đổi kênh/chi tiết, để Lead cũ chưa có chi tiết vẫn sửa được tên, SĐT...
   */
  async update(id: string, input: UpdateLeadInput, actor: LeadActor): Promise<LeadRecordDto> {
    const existing = await findLeadById(id);
    if (!existing) {
      throw new LeadServiceError("Không tìm thấy Lead", 404);
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    const changes: string[] = [];

    if (input.customerName !== undefined) {
      const value = typeof input.customerName === "string" ? input.customerName.trim() : "";
      if (!value) {
        throw new LeadServiceError("Tên khách hàng không được để trống", 400);
      }
      if (value.length > 200) {
        throw new LeadServiceError("Tên khách hàng tối đa 200 ký tự", 400);
      }
      if (value !== existing.customerName) {
        sets.push("customer_name = ?");
        params.push(value);
        changes.push(`Tên: "${existing.customerName}" -> "${value}"`);
      }
    }

    if (input.phone !== undefined) {
      const value = typeof input.phone === "string" ? input.phone.trim() : "";
      if (!value) {
        throw new LeadServiceError("Số điện thoại không được để trống", 400);
      }
      if (value.length > 30) {
        throw new LeadServiceError("Số điện thoại tối đa 30 ký tự", 400);
      }
      if (value !== existing.phone) {
        sets.push("phone = ?");
        params.push(value);
        changes.push(`SĐT: ${existing.phone} -> ${value}`);
      }
    }

    if (input.email !== undefined) {
      const value = parseEmail(input.email);
      if (value !== existing.email) {
        sets.push("email = ?");
        params.push(value);
        changes.push("Email");
      }
    }

    if (input.group !== undefined) {
      if (typeof input.group !== "string" || !(LEAD_GROUPS as readonly string[]).includes(input.group)) {
        throw new LeadServiceError("Nhóm cơ hội không hợp lệ", 400);
      }
      if (input.group !== existing.group) {
        sets.push("group_name = ?");
        params.push(input.group);
        changes.push(`Nhóm: ${existing.group} -> ${input.group}`);
      }
    }

    if (input.expectedValue !== undefined) {
      const value = parseExpectedValue(input.expectedValue);
      if (value !== Number(existing.expectedValue)) {
        sets.push("expected_value = ?");
        params.push(value);
        changes.push(`Giá trị dự kiến: ${existing.expectedValue} -> ${value}`);
      }
    }

    if (input.demandDescription !== undefined) {
      if (typeof input.demandDescription !== "string") {
        throw new LeadServiceError("Nhu cầu phải là chuỗi", 400);
      }
      const value = input.demandDescription.trim();
      if (value.length > 2000) {
        throw new LeadServiceError("Nhu cầu tối đa 2000 ký tự", 400);
      }
      if (value !== (existing.demandDescription ?? "")) {
        sets.push("demand_description = ?");
        params.push(value);
        changes.push("Nhu cầu");
      }
    }

    if (input.note !== undefined) {
      const value = parseNote(input.note);
      if (value !== existing.note) {
        sets.push("note = ?");
        params.push(value);
        changes.push("Ghi chú");
      }
    }

    // Kênh + chi tiết kênh
    const channelTouched =
      input.channel !== undefined || input.channelSourceId !== undefined || input.referredByCtvId !== undefined;
    if (channelTouched) {
      const channel = input.channel === undefined ? existing.channel : String(input.channel);
      if (!(LEAD_CHANNELS as readonly string[]).includes(channel)) {
        throw new LeadServiceError("Kênh phát triển không hợp lệ", 400);
      }
      const channelChanged = channel !== existing.channel;
      const sourceId =
        input.channelSourceId !== undefined
          ? input.channelSourceId
            ? String(input.channelSourceId)
            : null
          : channelChanged
            ? null
            : existing.channelSourceId;
      const ctvId =
        input.referredByCtvId !== undefined
          ? input.referredByCtvId
            ? String(input.referredByCtvId)
            : null
          : channelChanged
            ? null
            : existing.referredByCtvId;

      const unchanged =
        !channelChanged && sourceId === existing.channelSourceId && ctvId === existing.referredByCtvId;
      if (!unchanged) {
        const detail = await validateLeadChannelDetail(
          { channel, channelSourceId: sourceId, referredByCtvId: ctvId },
          { keepInactiveSourceId: existing.channelSourceId, keepCtvId: existing.referredByCtvId }
        );
        sets.push("channel = ?", "channel_source_id = ?", "referred_by_ctv_id = ?");
        params.push(channel, detail.channelSourceId, detail.referredByCtvId);
        changes.push(`Kênh: ${existing.channel} -> ${channel}`);
      }
    }

    if (!sets.length) {
      return existing;
    }

    await run(`UPDATE leads SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...params, id]);
    await writeAudit(actor.name, "Sửa Lead", `Admin sửa Lead ${id} (${existing.customerName}): ${changes.join("; ")}`);
    return (await findLeadById(id))!;
  }

  /**
   * Đổi trạng thái. Nhân viên chỉ được đi tiến (hoặc sang Thất bại từ bước 0-2);
   * lùi bước bị chặn 409 và phải gửi yêu cầu cho Admin. Admin đổi tự do.
   */
  async updateStatus(id: string, status: string, actor: LeadActor): Promise<LeadRecordDto> {
    if (!status) {
      throw new LeadServiceError("Thiếu trạng thái cần cập nhật", 400);
    }

    if (!isLeadStatus(status)) {
      throw new LeadServiceError("Trạng thái không hợp lệ", 400);
    }

    const existing = await query<{ status: string | null; customer_name: string }>(
      "SELECT status, customer_name FROM leads WHERE id = ?",
      [id]
    );
    if (!existing.length) {
      throw new LeadServiceError("Không tìm thấy Lead", 404);
    }
    const current = existing[0].status ?? DEFAULT_LEAD_STATUS;
    if (current === status) {
      return (await findLeadById(id))!;
    }

    const backward = isBackwardMove(current, status);
    if (backward && !actor.isAdmin) {
      throw new LeadServiceError(BACKWARD_BLOCKED_MESSAGE, 409);
    }

    // Điều kiện status = current để hai thao tác đồng thời không lách được quy tắc.
    const result = await run(
      "UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IS NOT DISTINCT FROM ?",
      [status, id, existing[0].status]
    );
    if (result.changes === 0) {
      throw new LeadServiceError("Trạng thái Lead vừa được người khác thay đổi, vui lòng tải lại trang", 409);
    }

    if (backward) {
      await writeAudit(
        actor.name,
        "Admin đổi Lead lùi bước",
        `Lead ${id} (${existing[0].customer_name}): ${current} -> ${status}`
      );
    }

    return (await findLeadById(id))!;
  }

  async assign(id: string, input: LeadAssignmentInput): Promise<LeadRecordDto> {
    const hasStaff = input.staffName !== undefined;
    const hasTerritory = input.territoryId !== undefined;
    if (!hasStaff && !hasTerritory) {
      throw new LeadServiceError("Thiếu thông tin phân công (nhân viên hoặc phường)", 400);
    }

    const existing = await query("SELECT id FROM leads WHERE id = ?", [id]);
    if (!existing.length) {
      throw new LeadServiceError("Không tìm thấy Lead", 404);
    }

    const sets: string[] = [];
    const params: any[] = [];

    if (hasStaff) {
      const staffName = typeof input.staffName === "string" ? input.staffName.trim() : "";
      if (!staffName) {
        throw new LeadServiceError("Tên nhân viên không được để trống", 400);
      }
      const staff = await query<{ id: string; status: string }>("SELECT id, status FROM staff WHERE name = ?", [staffName]);
      if (!staff.length) {
        throw new LeadServiceError("Nhân viên không tồn tại", 400);
      }
      if (staff[0].status && staff[0].status !== "Đang hoạt động") {
        throw new LeadServiceError("Nhân viên đang bị đình chỉ hoặc đã ngừng hoạt động", 400);
      }
      sets.push("staff_name = ?");
      params.push(staffName);
    }

    if (hasTerritory) {
      if (input.territoryId === null || input.territoryId === "") {
        sets.push("territory_id = ?");
        params.push(null);
      } else {
        const territoryId = String(input.territoryId);
        await assertTerritoryExists(territoryId);
        sets.push("territory_id = ?");
        params.push(territoryId);
      }
    }

    await run(
      `UPDATE leads SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...params, id]
    );

    return (await findLeadById(id))!;
  }

  /** Xóa cứng Lead (chỉ Admin). Chặn nếu Lead đã được dùng để tạo Đơn hàng. */
  async remove(id: string, actor: LeadActor): Promise<void> {
    const existing = await findLeadById(id);
    if (!existing) {
      throw new LeadServiceError("Không tìm thấy Lead", 404);
    }

    const contracts = await query<{ id: string }>("SELECT id FROM contracts WHERE lead_id = ?", [id]);
    if (contracts.length) {
      throw new LeadServiceError(
        `Lead đã được dùng để tạo ${contracts.length} đơn hàng, không thể xóa. Hãy xóa/tách đơn hàng trước.`,
        409
      );
    }

    await run("DELETE FROM lead_stage_requests WHERE lead_id = ?", [id]);
    await run("DELETE FROM leads WHERE id = ?", [id]);
    await writeAudit(actor.name, "Xóa Lead", `Xóa Lead ${id} (${existing.customerName})`);
  }

  async updateNote(id: string, noteInput: string): Promise<LeadRecordDto> {
    if (typeof noteInput !== "string") {
      throw new LeadServiceError("Ghi chú phải là chuỗi", 400);
    }
    const trimmed = noteInput.trim();
    if (trimmed.length > 1000) {
      throw new LeadServiceError("Ghi chú tối đa 1000 ký tự", 400);
    }
    const existing = await query("SELECT id FROM leads WHERE id = ?", [id]);
    if (!existing.length) {
      throw new LeadServiceError("Không tìm thấy Lead", 404);
    }
    const note = trimmed.length > 0 ? trimmed : null;
    await run(
      "UPDATE leads SET note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [note, id]
    );
    return (await findLeadById(id))!;
  }
}
