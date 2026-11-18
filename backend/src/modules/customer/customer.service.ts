import { query, run, transaction } from "../../database/db.js";
import { CUSTOMER_GROUPS, LEAD_CHANNELS, ROLES, USER_STATUS } from "../../constants/org.js";
import { normalizeTaxCode } from "../../utils/tax-code.js";
import { validateChannelDetail, ChannelSourceError } from "../channel-source/channel-source.service.js";
import fs from "fs";
import path from "path";
import { config } from "../../config/index.js";

const GROUP_LABEL: Record<string, string> = {
  "Tự phát triển": "KH PTM",
  "Tập hiện hữu": "KH địa bàn",
  "PTM địa bàn": "PTM địa bàn",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: unknown): boolean {
  return typeof email === "string" && EMAIL_PATTERN.test(email);
}

function isValidChannel(channel: unknown): boolean {
  return typeof channel === "string" && (LEAD_CHANNELS as readonly string[]).includes(channel);
}

export interface BatchCustomerItem {
  identityCode?: string;
  phone?: string;
  name: string;
  type?: string;
  address?: string;
  services?: string;
}

export interface CustomerBatchInput {
  /** Tùy chọn kể từ feedback 17/11; bắt buộc chỉ khi mode = "replace". */
  territoryId?: string | null;
  amCaringStaff: string;
  handoverBatch: string;
  mode: "append" | "replace";
  customers: BatchCustomerItem[];
}

export interface CustomerBatchResult {
  createdCount: number;
  updatedCount: number;
  clearedCount: number;
  totalProcessed: number;
}

export class CustomerServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409
  ) {
    super(message);
  }
}

export interface CustomerOperator {
  name: string;
  role: string;
}

export interface CtvOptionDto {
  id: string;
  code: string;
  name: string;
}

async function assertActiveStaff(name: string, label: string): Promise<void> {
  const rows = await query<any>("SELECT id, status FROM staff WHERE name = ?", [name]);
  if (rows.length === 0) {
    throw new CustomerServiceError(`${label} "${name}" không tồn tại`, 400);
  }
  if (rows[0].status && rows[0].status !== USER_STATUS.ACTIVE) {
    throw new CustomerServiceError(`${label} "${name}" đang bị đình chỉ hoặc đã ngừng hoạt động`, 400);
  }
}

async function assertActiveCtv(id: string): Promise<void> {
  const rows = await query<any>("SELECT id, status FROM users WHERE id = ? AND role = ?", [id, ROLES.CTV]);
  if (rows.length === 0) {
    throw new CustomerServiceError("CTV giới thiệu không tồn tại", 400);
  }
  if (rows[0].status && rows[0].status !== USER_STATUS.ACTIVE) {
    throw new CustomerServiceError("CTV giới thiệu chưa được duyệt hoặc đã ngừng hoạt động", 400);
  }
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidGroup(group: unknown): group is (typeof CUSTOMER_GROUPS)[number] {
  return typeof group === "string" && (CUSTOMER_GROUPS as readonly string[]).includes(group);
}

/** Chuyển lỗi kiểm tra "Chi tiết kênh" (dùng chung với Lead/Đơn hàng) thành lỗi của Khách hàng. */
async function validateCustomerChannelDetail(
  input: { channel: string; channelSourceId?: string | null; referredByCtvId?: string | null },
  options?: { keepInactiveSourceId?: string | null; keepCtvId?: string | null }
) {
  try {
    return await validateChannelDetail(input, options);
  } catch (error) {
    if (error instanceof ChannelSourceError) {
      throw new CustomerServiceError(error.message, error.status === 403 ? 403 : error.status === 404 ? 404 : 400);
    }
    throw error;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const CUSTOMER_SELECT = `SELECT c.*, t.ward_name AS territory_name, ct.name AS team_name,
         u.name AS referred_by_ctv_name, u.referral_code AS referred_by_ctv_code,
         cs.name AS channel_source_name
  FROM customers c
  LEFT JOIN territories t ON t.id = c.territory_id
  LEFT JOIN customer_teams ct ON ct.id = c.team_id
  LEFT JOIN users u ON u.id = c.referred_by_ctv_id
  LEFT JOIN channel_sources cs ON cs.id = c.channel_source_id`;

/** SELECT khách hàng kèm territory_name/team_name/CTV giới thiệu (dùng chung cho getAll/getById/create/update). */
async function fetchCustomerWithJoins(id: string): Promise<any | undefined> {
  const rows = await query<any>(
    `${CUSTOMER_SELECT}
     WHERE c.id = ?`,
    [id]
  );
  return rows[0];
}

export class CustomerService {
  async getAll(search?: string, group?: string) {
    if (group !== undefined && group !== "" && !isValidGroup(group)) {
      throw new CustomerServiceError("Nhóm khách hàng không hợp lệ", 400);
    }

    let sql = `${CUSTOMER_SELECT}
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      sql += " AND (c.name LIKE ? OR c.identity_code LIKE ? OR c.phone LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    if (group) {
      sql += " AND c.customer_group = ?";
      params.push(group);
    }

    sql += " ORDER BY c.created_at DESC";
    return query(sql, params);
  }

  /** Danh sách CTV đang hoạt động để chọn "CTV giới thiệu" (mọi nhân viên đều gọi được, khác /ctv-accounts chỉ Admin). */
  async listCtvOptions(): Promise<CtvOptionDto[]> {
    const rows = await query<any>(
      "SELECT id, name, referral_code FROM users WHERE role = ? AND (status IS NULL OR status = ?) ORDER BY name",
      [ROLES.CTV, USER_STATUS.ACTIVE]
    );
    return rows.map((row) => ({ id: row.id, code: row.referral_code ?? "", name: row.name }));
  }

  async create(
    data: {
      name: string;
      identityCode?: string;
      type: string;
      customerGroup: string;
      phone?: string;
      address?: string;
      services?: string;
      amStaff?: string;
      amCaringStaff?: string;
      handoverBatch?: string;
      territoryId?: string;
      customerCode?: string;
      status?: string;
      teamId?: string;
      salesChannel?: string;
      contactName?: string;
      contactEmail?: string;
      billingName?: string;
      billingPhone?: string;
      billingEmail?: string;
      note?: string;
      referredByCtvId?: string;
      channelSourceId?: string;
    },
    operator?: CustomerOperator
  ) {
    if (!isValidGroup(data.customerGroup)) {
      throw new CustomerServiceError("Nhóm khách hàng không hợp lệ", 400);
    }
    if (data.salesChannel && !isValidChannel(data.salesChannel)) {
      throw new CustomerServiceError("Kênh bán không hợp lệ", 400);
    }
    if (data.contactEmail && !isValidEmail(data.contactEmail)) {
      throw new CustomerServiceError("Email liên hệ không hợp lệ", 400);
    }
    if (data.billingEmail && !isValidEmail(data.billingEmail)) {
      throw new CustomerServiceError("Email thanh toán không hợp lệ", 400);
    }
    if (data.teamId) {
      const teamRows = await query("SELECT id FROM customer_teams WHERE id = ?", [data.teamId]);
      if (teamRows.length === 0) {
        throw new CustomerServiceError("Team không tồn tại", 400);
      }
    }

    // Kênh bán + chi tiết (nguồn Online/đối tác/CTV) — cùng cơ chế với Lead/Đơn hàng.
    const channelDetail = await validateCustomerChannelDetail({
      channel: data.salesChannel ?? "",
      channelSourceId: data.channelSourceId,
      referredByCtvId: data.referredByCtvId,
    });
    const referredByCtvId = channelDetail.referredByCtvId;
    const channelSourceId = channelDetail.channelSourceId;

    const handoverBatch =
      typeof data.handoverBatch === "string" ? data.handoverBatch.trim() : "";

    let amStaff = trimmed(data.amStaff);
    let amCaringStaff = trimmed(data.amCaringStaff);
    if (operator) {
      const actor = trimmed(operator.name);
      if (operator.role === ROLES.ADMIN) {
        if (amStaff) await assertActiveStaff(amStaff, "AM bán hàng");
        if (amCaringStaff) await assertActiveStaff(amCaringStaff, "AM chăm sóc");
      } else {
        if (amStaff && amStaff !== actor) {
          throw new CustomerServiceError("Bạn chỉ được tạo khách hàng với AM bán hàng là chính mình", 403);
        }
        amStaff = actor;
        if (amCaringStaff && amCaringStaff !== actor) {
          await assertActiveStaff(amCaringStaff, "AM chăm sóc");
        }
      }
    }

    const id = `KH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    amStaff = amStaff || "Nguyễn Thị Tình";
    // AM chăm sóc (CSKH) là field độc lập với AM bán hàng — chỉ dùng amStaff làm
    // mặc định khi người tạo không chỉ định rõ amCaringStaff, không ép buộc trùng nhau.
    amCaringStaff = amCaringStaff || amStaff;
    const identityCode = data.identityCode ? normalizeTaxCode(data.identityCode) : "";

    await run(
      `INSERT INTO customers (
        id, name, identity_code, type, customer_group, phone, address, services, am_staff, am_caring_staff,
        handover_batch, handover_date, territory_id, customer_code, status, team_id, sales_channel,
        contact_name, contact_email, billing_name, billing_phone, billing_email, note, referred_by_ctv_id,
        channel_source_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        identityCode || null,
        data.type,
        data.customerGroup,
        data.phone || null,
        data.address || null,
        trimmed(data.services) || null,
        amStaff,
        amCaringStaff,
        handoverBatch || null,
        handoverBatch ? today() : null,
        data.territoryId || null,
        data.customerCode || null,
        data.status || null,
        data.teamId || null,
        data.salesChannel || null,
        data.contactName || null,
        data.contactEmail || null,
        data.billingName || null,
        data.billingPhone || null,
        data.billingEmail || null,
        data.note || null,
        referredByCtvId || null,
        channelSourceId || null,
      ]
    );

    // Trả kèm territory_name/team_name/CTV giới thiệu (giống getById) để FE không cần gọi lại
    // GET /customers sau khi tạo mới vẫn thấy đúng badge địa bàn/Team ngay.
    const created = await fetchCustomerWithJoins(id);

    return { success: true, customer: created, message: "Thêm khách hàng thành công" };
  }

  /** Lấy 1 khách hàng kèm tên địa bàn/team (join territories/customer_teams); 404 nếu không có. */
  async getById(id: string) {
    const customer = await fetchCustomerWithJoins(id);
    if (!customer) {
      throw new CustomerServiceError("Không tìm thấy khách hàng", 404);
    }
    return customer;
  }

  /**
   * Sửa thông tin khách hàng. Admin sửa được mọi khách và được đổi AM bán hàng /
   * AM chăm sóc. AM chỉ sửa được khách mình đang phụ trách (am_staff hoặc
   * am_caring_staff khớp tên người gọi, so sánh đã trim); AM không đổi được AM
   * bán hàng, và chỉ AM bán hàng của khách mới đổi được AM chăm sóc. Giá trị AM
   * gửi lên trùng giá trị hiện tại thì bỏ qua. Luồng Điều chuyển vẫn là route riêng.
   */
  async update(
    id: string,
    patch: Record<string, unknown>,
    operator: { name: string; role: string }
  ) {
    const existingRows = await query<any>("SELECT * FROM customers WHERE id = ?", [id]);
    if (existingRows.length === 0) {
      throw new CustomerServiceError("Không tìm thấy khách hàng", 404);
    }
    const existing = existingRows[0];

    if (operator.role !== "Admin") {
      const actor = (operator.name || "").trim();
      const isOwner =
        (existing.am_staff || "").trim() === actor || (existing.am_caring_staff || "").trim() === actor;
      if (!isOwner) {
        throw new CustomerServiceError("Bạn chỉ được sửa khách hàng mình đang phụ trách", 403);
      }
    }

    const isAdmin = operator.role === ROLES.ADMIN;
    const actor = trimmed(operator.name);
    const staffSets: { column: string; value: string | null }[] = [];
    const staffLogs: string[] = [];

    if ("amStaff" in patch) {
      const next = trimmed(patch.amStaff);
      if (!next) {
        throw new CustomerServiceError("AM bán hàng không được để trống", 400);
      }
      const current = trimmed(existing.am_staff);
      if (next !== current) {
        if (!isAdmin) {
          throw new CustomerServiceError("Chỉ Admin được đổi AM bán hàng, vui lòng nhờ Admin điều chuyển", 403);
        }
        await assertActiveStaff(next, "AM bán hàng");
        staffSets.push({ column: "am_staff", value: next });
        staffLogs.push(`AM bán hàng: ${current || "(chưa có)"} → ${next}`);
      }
    }

    if ("amCaringStaff" in patch) {
      const next = trimmed(patch.amCaringStaff);
      const current = trimmed(existing.am_caring_staff);
      if (next !== current) {
        if (!isAdmin && trimmed(existing.am_staff) !== actor) {
          throw new CustomerServiceError(
            "Chỉ AM bán hàng của khách hoặc Admin được đổi AM chăm sóc",
            403
          );
        }
        if (next) await assertActiveStaff(next, "AM chăm sóc");
        staffSets.push({ column: "am_caring_staff", value: next || null });
        staffLogs.push(`AM chăm sóc: ${current || "(chưa có)"} → ${next || "(bỏ trống)"}`);
      }
    }

    const fieldMap: Record<string, string> = {
      name: "name",
      identityCode: "identity_code",
      type: "type",
      customerGroup: "customer_group",
      phone: "phone",
      address: "address",
      territoryId: "territory_id",
      customerCode: "customer_code",
      status: "status",
      teamId: "team_id",
      salesChannel: "sales_channel",
      contactName: "contact_name",
      contactEmail: "contact_email",
      billingName: "billing_name",
      billingPhone: "billing_phone",
      billingEmail: "billing_email",
      note: "note",
      referredByCtvId: "referred_by_ctv_id",
    };

    if (patch.customerGroup !== undefined && !isValidGroup(patch.customerGroup)) {
      throw new CustomerServiceError("Nhóm khách hàng không hợp lệ", 400);
    }
    if (patch.salesChannel !== undefined && patch.salesChannel && !isValidChannel(patch.salesChannel)) {
      throw new CustomerServiceError("Kênh bán không hợp lệ", 400);
    }
    if (patch.contactEmail !== undefined && patch.contactEmail && !isValidEmail(patch.contactEmail)) {
      throw new CustomerServiceError("Email liên hệ không hợp lệ", 400);
    }
    if (patch.billingEmail !== undefined && patch.billingEmail && !isValidEmail(patch.billingEmail)) {
      throw new CustomerServiceError("Email thanh toán không hợp lệ", 400);
    }
    if (patch.identityCode !== undefined && patch.identityCode) {
      patch.identityCode = normalizeTaxCode(patch.identityCode);
    }
    if (patch.teamId !== undefined && patch.teamId) {
      const teamRows = await query("SELECT id FROM customer_teams WHERE id = ?", [patch.teamId]);
      if (teamRows.length === 0) {
        throw new CustomerServiceError("Team không tồn tại", 400);
      }
    }

    // Kênh bán + chi tiết (nguồn Online/đối tác/CTV): chỉ chạy lại validate khi
    // thực sự đụng tới kênh/nguồn/CTV, để dữ liệu cũ chưa có chi tiết không bị
    // bắt buộc điền khi chỉ sửa trường khác (giống Lead).
    const channelTouched =
      "salesChannel" in patch || "channelSourceId" in patch || "referredByCtvId" in patch;
    if (channelTouched) {
      const nextChannel = "salesChannel" in patch ? String(patch.salesChannel ?? "") : existing.sales_channel ?? "";
      const channelChanged = nextChannel !== (existing.sales_channel ?? "");
      const sourceId =
        "channelSourceId" in patch
          ? patch.channelSourceId
            ? String(patch.channelSourceId)
            : null
          : channelChanged
            ? null
            : existing.channel_source_id ?? null;
      const ctvId =
        "referredByCtvId" in patch
          ? patch.referredByCtvId
            ? String(patch.referredByCtvId)
            : null
          : channelChanged
            ? null
            : existing.referred_by_ctv_id ?? null;
      const detail = await validateCustomerChannelDetail(
        { channel: nextChannel, channelSourceId: sourceId, referredByCtvId: ctvId },
        { keepInactiveSourceId: existing.channel_source_id ?? null, keepCtvId: existing.referred_by_ctv_id ?? null }
      );
      patch.channelSourceId = detail.channelSourceId;
      patch.referredByCtvId = detail.referredByCtvId;
    }

    const sets: string[] = [];
    const params: any[] = [];
    for (const [key, column] of Object.entries(fieldMap)) {
      if (key in patch) {
        sets.push(`${column} = ?`);
        params.push(patch[key] ?? null);
      }
    }
    if (channelTouched) {
      sets.push("channel_source_id = ?");
      params.push(patch.channelSourceId ?? null);
    }
    for (const { column, value } of staffSets) {
      sets.push(`${column} = ?`);
      params.push(value);
    }

    if (sets.length === 0) {
      return fetchCustomerWithJoins(id);
    }

    params.push(id);
    await run(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`, params);

    await this.logTransfer(
      id,
      operator.name || "Admin",
      "Sửa thông tin khách hàng",
      `Sửa khách ${id}: cập nhật ${Object.keys(patch).join(", ")}${
        staffLogs.length > 0 ? ` (${staffLogs.join("; ")})` : ""
      }`
    );

    return fetchCustomerWithJoins(id);
  }

  /** Gán (hoặc gỡ, teamId = null) team cho nhiều khách hàng cùng lúc; trả về số khách đã cập nhật. */
  async assignTeam(customerIds: string[], teamId: string | null): Promise<number> {
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      throw new CustomerServiceError("Vui lòng chọn ít nhất 1 khách hàng", 400);
    }
    if (teamId) {
      const teamRows = await query("SELECT id FROM customer_teams WHERE id = ?", [teamId]);
      if (teamRows.length === 0) {
        throw new CustomerServiceError("Team không tồn tại", 400);
      }
    }

    let updated = 0;
    for (const customerId of customerIds) {
      const result = await run("UPDATE customers SET team_id = ? WHERE id = ?", [
        teamId || null,
        customerId,
      ]);
      updated += result.changes;
    }
    return updated;
  }

  /**
   * Gán AM chăm sóc và/hoặc AM phụ trách (bán hàng) cho nhiều khách hàng cùng
   * lúc (Đợt 8, Task 5). Cần ít nhất 1 trong 2 tên; tên phải tồn tại trong
   * bảng staff và đang hoạt động. Giới hạn 2000 id/lần, chạy trong 1
   * transaction, ghi 1 audit log tóm tắt số lượng.
   */
  async assignStaffBulk(
    input: { customerIds: string[]; amCaringStaff?: string; amStaff?: string },
    operator: string = "Admin"
  ): Promise<{ updated: number }> {
    const customerIds = Array.isArray(input?.customerIds) ? input.customerIds : [];
    if (customerIds.length === 0) {
      throw new CustomerServiceError("Vui lòng chọn ít nhất 1 khách hàng", 400);
    }
    if (customerIds.length > 2000) {
      throw new CustomerServiceError("Chỉ được gán tối đa 2000 khách hàng mỗi lần", 400);
    }

    const amCaringStaff = typeof input.amCaringStaff === "string" ? input.amCaringStaff.trim() : "";
    const amStaff = typeof input.amStaff === "string" ? input.amStaff.trim() : "";
    if (!amCaringStaff && !amStaff) {
      throw new CustomerServiceError("Vui lòng chọn AM chăm sóc hoặc AM phụ trách", 400);
    }

    for (const staffName of [amCaringStaff, amStaff].filter(Boolean)) {
      const staffRows = await query<any>("SELECT id, status FROM staff WHERE name = ?", [staffName]);
      if (staffRows.length === 0) {
        throw new CustomerServiceError(`Nhân viên "${staffName}" không tồn tại`, 400);
      }
      if (staffRows[0].status && staffRows[0].status !== "Đang hoạt động") {
        throw new CustomerServiceError(`Nhân viên "${staffName}" đang bị đình chỉ hoặc đã ngừng hoạt động`, 400);
      }
    }

    const updated = await transaction(async (tx) => {
      const sets: string[] = [];
      const baseParams: any[] = [];
      if (amCaringStaff) {
        sets.push("am_caring_staff = ?");
        baseParams.push(amCaringStaff);
      }
      if (amStaff) {
        sets.push("am_staff = ?");
        baseParams.push(amStaff);
      }

      let count = 0;
      for (const customerId of customerIds) {
        const params = [...baseParams, customerId];
        const result = await tx.run(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`, params);
        count += result.changes;
      }

      await tx.run(
        'INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)',
        [
          `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          operator,
          "Gán nhân viên cho nhiều khách hàng",
          `Gán ${count} khách hàng: ${amCaringStaff ? `AM chăm sóc = ${amCaringStaff}` : ""}${
            amCaringStaff && amStaff ? ", " : ""
          }${amStaff ? `AM phụ trách = ${amStaff}` : ""}`,
        ]
      );

      return count;
    });

    return { updated };
  }

  private async loadForTransfer(id: string, newStaff: unknown) {
    const staffName = typeof newStaff === "string" ? newStaff.trim() : "";
    if (!staffName) {
      throw new CustomerServiceError("Vui lòng chọn nhân viên phụ trách mới", 400);
    }

    const customers = await query<any>("SELECT * FROM customers WHERE id = ?", [id]);
    const customer = customers[0];
    if (!customer) {
      throw new CustomerServiceError("Không tìm thấy Khách hàng", 404);
    }

    const staffRows = await query<any>("SELECT id, status FROM staff WHERE name = ?", [staffName]);
    if (staffRows.length === 0) {
      throw new CustomerServiceError("Nhân viên phụ trách mới không tồn tại", 400);
    }
    if (staffRows[0].status && staffRows[0].status !== "Đang hoạt động") {
      throw new CustomerServiceError("Nhân viên đang bị đình chỉ hoặc đã ngừng hoạt động", 400);
    }

    return { customer, staffName };
  }

  private async logTransfer(id: string, operator: string, action: string, details: string) {
    await run(
      'INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)',
      [`LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, operator, action, details]
    );
  }

  // Điều chuyển AM bán hàng (am_staff) — người phát triển ban đầu. KHÔNG đụng
  // tới am_caring_staff; hai vai trò độc lập, xem transferCaringStaff() để
  // đổi AM chăm sóc (CSKH). Theo quyết định của Khoa, FE chỉ hiện nút này cho
  // khách KHDN chăm — KH PTM giữ nguyên người phát triển.
  async transfer(id: string, newStaff: string, operator: string = "Admin") {
    const { customer, staffName } = await this.loadForTransfer(id, newStaff);
    await run("UPDATE customers SET am_staff = ? WHERE id = ?", [staffName, id]);

    const groupLabel = GROUP_LABEL[customer.customer_group] ?? customer.customer_group;
    await this.logTransfer(
      id,
      operator,
      "Điều chuyển AM phụ trách",
      `Điều chuyển KH ${id} (${groupLabel}): ${customer.am_staff || "(chưa có)"} → ${staffName}`
    );

    return { success: true, message: `Đã điều chuyển AM phụ trách cho ${staffName}` };
  }

  // Điều chuyển AM chăm sóc (CSKH, am_caring_staff). Không đụng tới am_staff.
  // Áp dụng cho mọi khách; đây là hành động "bàn giao" nên nhận kèm đợt giao.
  async transferCaringStaff(
    id: string,
    newCaringStaff: string,
    operator: string = "Admin",
    handoverBatch?: string
  ) {
    const { customer, staffName } = await this.loadForTransfer(id, newCaringStaff);
    const batch = typeof handoverBatch === "string" ? handoverBatch.trim() : "";

    const sets: string[] = ["am_caring_staff = ?"];
    const params: any[] = [staffName];
    if (batch) {
      sets.push("handover_batch = ?", "handover_date = ?");
      params.push(batch, today());
    }
    params.push(id);
    await run(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`, params);

    const groupLabel = GROUP_LABEL[customer.customer_group] ?? customer.customer_group;
    const oldCaring = customer.am_caring_staff || customer.am_staff || "(chưa có)";
    await this.logTransfer(
      id,
      operator,
      "Điều chuyển AM chăm sóc (CSKH)",
      `Điều chuyển KH ${id} (${groupLabel}): ${oldCaring} → ${staffName}${
        batch ? `, đợt ${batch}` : ""
      }`
    );

    return { success: true, message: `Đã điều chuyển AM chăm sóc cho ${staffName}` };
  }

  async importBatch(
    payload: CustomerBatchInput,
    operator: string = "Admin"
  ): Promise<CustomerBatchResult> {
    const { territoryId, amCaringStaff, handoverBatch, mode, customers } = payload ?? {};

    // Phường/địa bàn không còn bắt buộc (feedback khách 17/11) — chế độ "replace"
    // vẫn cần Phường vì nó xác lập lại TOÀN BỘ tập khách của một Phường cụ thể.
    if (!territoryId && mode === "replace") {
      throw new CustomerServiceError("Chế độ xác lập lại theo đợt cần chọn Địa bàn / Phường", 400);
    }
    if (territoryId) {
      const terrRows = await query("SELECT id FROM territories WHERE id = ?", [territoryId]);
      if (terrRows.length === 0) {
        throw new CustomerServiceError("Địa bàn không tồn tại", 404);
      }
    }

    if (!amCaringStaff || typeof amCaringStaff !== "string") {
      throw new CustomerServiceError("Vui lòng chọn AM chăm sóc (CSKH)", 400);
    }
    const staffRows = await query<any>("SELECT id, status FROM staff WHERE name = ?", [amCaringStaff.trim()]);
    if (staffRows.length === 0) {
      throw new CustomerServiceError("Nhân viên phụ trách chăm sóc không tồn tại", 400);
    }
    if (staffRows[0].status && staffRows[0].status !== "Đang hoạt động") {
      throw new CustomerServiceError("Nhân viên đang bị đình chỉ hoặc đã ngừng hoạt động", 400);
    }

    const batch = typeof handoverBatch === "string" ? handoverBatch.trim() : "";
    if (!batch) {
      throw new CustomerServiceError("Vui lòng nhập mã đợt giao", 400);
    }

    if (mode !== "append" && mode !== "replace") {
      throw new CustomerServiceError("Chế độ nhập không hợp lệ (phải là append hoặc replace)", 400);
    }

    if (!Array.isArray(customers) || customers.length === 0) {
      throw new CustomerServiceError("Danh sách khách hàng không được để trống", 400);
    }

    return transaction(async (tx) => {
      let createdCount = 0;
      let updatedCount = 0;
      let clearedCount = 0;
      const touchedCustomerIds = new Set<string>();

      for (let i = 0; i < customers.length; i++) {
        const item = customers[i];
        const name = typeof item.name === "string" ? item.name.trim() : "";
        if (!name) {
          throw new CustomerServiceError(`Dòng ${i + 1}: Tên khách hàng không được để trống`, 400);
        }

        const idCode = typeof item.identityCode === "string" ? item.identityCode.trim() : "";
        const phone = typeof item.phone === "string" ? item.phone.trim() : "";

        // Tìm khách đã tồn tại: ưu tiên identityCode rồi đến phone
        let existing: any = null;
        if (idCode) {
          const rows = await tx.query("SELECT * FROM customers WHERE identity_code = ?", [idCode]);
          if (rows.length > 0) existing = rows[0];
        }
        if (!existing && phone) {
          const rows = await tx.query("SELECT * FROM customers WHERE phone = ?", [phone]);
          if (rows.length > 0) existing = rows[0];
        }

        if (existing) {
          await tx.run(
            `UPDATE customers SET 
              am_caring_staff = ?,
              handover_batch = ?,
              handover_date = ?,
              territory_id = ?
            WHERE id = ?`,
            [amCaringStaff.trim(), batch, today(), territoryId, existing.id]
          );
          touchedCustomerIds.add(existing.id);
          updatedCount++;
        } else {
          const newId = `KH-B-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
          await tx.run(
            `INSERT INTO customers (
              id, name, identity_code, type, customer_group, phone, address, services,
              am_staff, am_caring_staff, handover_batch, handover_date, territory_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newId,
              name,
              idCode || null,
              item.type || "Doanh nghiệp",
              "Tập hiện hữu",
              phone || null,
              item.address || null,
              trimmed(item.services) || null,
              amCaringStaff.trim(),
              amCaringStaff.trim(),
              batch,
              today(),
              territoryId,
            ]
          );
          touchedCustomerIds.add(newId);
          createdCount++;
        }
      }

      // Nếu mode === "replace": xác lập lại tập — gỡ người chăm sóc của khách cũ cùng territoryId
      if (mode === "replace") {
        const terrOld = await tx.query<any>(
          "SELECT id FROM customers WHERE territory_id = ? AND customer_group = 'Tập hiện hữu'",
          [territoryId]
        );
        for (const row of terrOld) {
          if (!touchedCustomerIds.has(row.id)) {
            await tx.run(
              "UPDATE customers SET am_caring_staff = NULL WHERE id = ?",
              [row.id]
            );
            clearedCount++;
          }
        }
      }

      // Ghi audit log
      await tx.run(
        'INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)',
        [
          `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          operator,
          `Nhập đợt KHDN chăm (${mode})`,
          `Đợt: ${batch}, Phường: ${territoryId}, AM chăm sóc: ${amCaringStaff.trim()}. Tạo mới: ${createdCount}, Cập nhật: ${updatedCount}, Xác lập lại (gỡ gán cũ): ${clearedCount}`,
        ]
      );

      return {
        createdCount,
        updatedCount,
        clearedCount,
        totalProcessed: customers.length,
      };
    });
  }

  /**
   * Xóa khách hàng (chỉ Admin — kiểm tra ở controller). Chặn (409) nếu khách còn
   * đơn hàng (và theo đó là hoa hồng liên quan, vì hoa hồng luôn gắn qua đơn
   * hàng). Nếu chỉ còn dữ liệu phụ (giấy tờ đính kèm, dịch vụ nhập tay) thì xóa
   * cùng transaction, kèm xóa file giấy tờ trên đĩa, và ghi audit log.
   */
  async delete(id: string, operator: string = "Admin"): Promise<{ message: string }> {
    const existing = await query<{ id: string; name: string }>("SELECT id, name FROM customers WHERE id = ?", [id]);
    if (!existing.length) {
      throw new CustomerServiceError("Không tìm thấy khách hàng", 404);
    }
    const customer = existing[0];

    const contractRows = await query<{ total: string }>(
      "SELECT COUNT(*) AS total FROM contracts WHERE customer_id = ?",
      [id]
    );
    const contractCount = Number(contractRows[0]?.total ?? 0);
    if (contractCount > 0) {
      throw new CustomerServiceError(
        `Khách hàng còn ${contractCount} đơn hàng (và hoa hồng liên quan nếu có), hãy xóa đơn hàng trước khi xóa khách`,
        409
      );
    }

    const docRows = await query<{ stored_name: string }>(
      "SELECT stored_name FROM customer_documents WHERE customer_id = ?",
      [id]
    );

    await transaction(async (tx) => {
      await tx.run("DELETE FROM customer_documents WHERE customer_id = ?", [id]);
      await tx.run("DELETE FROM services WHERE customer_id = ? AND contract_id IS NULL", [id]);
      await tx.run("DELETE FROM customers WHERE id = ?", [id]);
      await tx.run(
        'INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)',
        [
          `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          operator,
          "Xóa khách hàng",
          `Xóa khách ${id} (${customer.name})`,
        ]
      );
    });

    // Xóa file giấy tờ trên đĩa SAU khi DB đã commit (không để treo file nếu transaction rollback).
    const docsDir = path.join(config.uploadDir, "customer-docs", id);
    for (const doc of docRows) {
      try {
        fs.rmSync(path.join(docsDir, doc.stored_name), { force: true });
      } catch {
        // Bỏ qua lỗi xóa từng file lẻ (vd đã bị xóa tay trước đó) — không chặn việc xóa khách.
      }
    }
    try {
      fs.rmdirSync(docsDir);
    } catch {
      // Thư mục có thể không rỗng/không tồn tại — bỏ qua.
    }

    return { message: `Đã xóa khách hàng "${customer.name}"` };
  }
}
