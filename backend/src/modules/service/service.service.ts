import { query, run } from "../../database/db.js";
import { SERVICE_GROUPS, PAYMENT_METHODS } from "../../constants/org.js";
import { todayVn } from "../../utils/date-vn.js";
import {
  decryptInvoicePassword,
  encryptInvoicePassword,
  MASKED_PASSWORD,
} from "./invoice-credential-crypto.js";

/**
 * Dịch vụ "Hóa đơn điện tử" (so khớp không phân biệt hoa thường/dấu trong tên
 * dịch vụ, vd "Hóa đơn điện tử VNPT Invoice") mới có khối thông tin đăng nhập
 * hệ thống hóa đơn (link/tài khoản/mật khẩu).
 */
export function isInvoicePortalService(serviceName: string | null | undefined): boolean {
  if (!serviceName) return false;
  const normalized = serviceName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
  return normalized.includes("hoa don dien tu");
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export interface ServiceRow {
  id: string;
  customer_name: string;
  service_name: string;
  service_code: string;
  start_date: string;
  /** NULL = dịch vụ không có thời hạn (vd: hóa đơn điện tử). */
  expiration_date: string | null;
  staff_name: string;
  customer_id?: string | null;
  service_group?: string | null;
  package_name?: string | null;
  payment_type?: string | null;
  contract_id?: string | null;
  contract_transaction_code?: string | null;
  invoice_portal_url?: string | null;
  invoice_portal_username?: string | null;
  invoice_portal_password_enc?: string | null;
  /** NULL = còn dùng; có giá trị = đã "xóa" (soft delete, giữ nguyên dữ liệu). */
  archived_at?: string | null;
}

export interface ServiceRecordDto {
  id: string;
  customerName: string;
  serviceName: string;
  serviceCode: string;
  startDate: string;
  /** NULL = dịch vụ không có thời hạn (vd: hóa đơn điện tử). */
  expirationDate: string | null;
  /** NULL khi dịch vụ không có thời hạn (không tính được "còn bao nhiêu ngày"). */
  daysRemaining: number | null;
  staffName: string;
  isExpired: boolean;
  customerId: string | null;
  serviceGroup: string | null;
  packageName: string | null;
  paymentType: string | null;
  contractId: string | null;
  transactionCode: string | null;
  /** true nếu tên dịch vụ thuộc "Hóa đơn điện tử" (FE hiện khối thông tin đăng nhập). */
  isInvoicePortalService: boolean;
  invoicePortalUrl: string | null;
  invoicePortalUsername: string | null;
  /** "••••••" nếu đã có mật khẩu, null nếu chưa nhập — KHÔNG BAO GIỜ trả plaintext ở đây. */
  invoicePortalPasswordMasked: string | null;
  /** true = đã "xóa" (soft delete) — chỉ còn hiển thị (mờ) trên hồ sơ khách hàng, không còn trên trang Dịch vụ & Cảnh báo. */
  isArchived: boolean;
}

export class ServiceServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404
  ) {
    super(message);
  }
}

function toServiceRecord(row: ServiceRow): ServiceRecordDto {
  const daysRemaining = row.expiration_date
    ? Math.ceil((new Date(row.expiration_date).getTime() - new Date().getTime()) / 86400000)
    : null;

  return {
    id: row.id,
    customerName: row.customer_name,
    serviceName: row.service_name,
    serviceCode: row.service_code,
    startDate: row.start_date,
    expirationDate: row.expiration_date,
    daysRemaining,
    staffName: row.staff_name,
    isExpired: daysRemaining !== null && daysRemaining < 0,
    customerId: row.customer_id ?? null,
    serviceGroup: row.service_group ?? null,
    packageName: row.package_name ?? null,
    paymentType: row.payment_type ?? null,
    contractId: row.contract_id ?? null,
    transactionCode: row.contract_transaction_code ?? null,
    isInvoicePortalService: isInvoicePortalService(row.service_name),
    invoicePortalUrl: row.invoice_portal_url ?? null,
    invoicePortalUsername: row.invoice_portal_username ?? null,
    invoicePortalPasswordMasked: row.invoice_portal_password_enc ? MASKED_PASSWORD : null,
    isArchived: Boolean(row.archived_at),
  };
}

const SERVICE_SELECT = `
  SELECT s.*, c.transaction_code AS contract_transaction_code
  FROM services s
  LEFT JOIN contracts c ON c.id = s.contract_id
`;

function contractLinkedMessage(row: ServiceRow): string {
  const code = row.contract_transaction_code ? ` ${row.contract_transaction_code}` : "";
  return `Dịch vụ này sinh từ đơn hàng${code}, vui lòng chỉnh sửa ở đơn hàng`;
}

function isValidServiceGroup(v: unknown): v is (typeof SERVICE_GROUPS)[number] {
  return typeof v === "string" && (SERVICE_GROUPS as readonly string[]).includes(v);
}

function isValidPaymentType(v: unknown): v is (typeof PAYMENT_METHODS)[number] {
  return typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);
}

export interface ServiceDb {
  query: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
  run: (sql: string, params?: any[]) => Promise<unknown>;
}

/**
 * Cập nhật lại tóm tắt dịch vụ trên bảng customers (cột `services` nối tên
 * dịch vụ bằng ", ", `nearest_expiration` = ngày hết hạn sớm nhất còn hiệu
 * lực từ hôm nay) để bảng danh sách khách hàng cũ (dòng 1 `customers`) vẫn
 * hiển thị đúng sau khi thêm/sửa/xóa dịch vụ của khách.
 *
 * `services` liệt kê TẤT CẢ dịch vụ (kể cả đã tắt cảnh báo/archived) — dữ liệu
 * dịch vụ của khách không bị giảm. `nearest_expiration` chỉ tính trên dịch vụ
 * CHƯA tắt cảnh báo, vì nó phục vụ việc nhắc hạn/cảnh báo.
 */
export async function refreshCustomerSummary(
  customerId: string,
  db: ServiceDb = { query, run }
): Promise<void> {
  const rows = await db.query<{ service_name: string; expiration_date: string | null; archived_at: string | null }>(
    "SELECT service_name, expiration_date, archived_at FROM services WHERE customer_id = ? ORDER BY expiration_date ASC",
    [customerId]
  );

  const servicesJoined = Array.from(new Set(rows.map((r) => r.service_name))).join(", ");
  const today = todayVn();
  const nearest = rows.find(
    (r) => r.archived_at === null && r.expiration_date !== null && r.expiration_date >= today
  );

  await db.run("UPDATE customers SET services = ?, nearest_expiration = ? WHERE id = ?", [
    servicesJoined || null,
    nearest ? nearest.expiration_date : null,
    customerId,
  ]);
}

export interface CreateServiceInput {
  customerId: string;
  serviceGroup: string;
  serviceName: string;
  packageName?: string;
  serviceCode: string;
  paymentType: string;
  startDate: string;
  /** Để trống = dịch vụ không có thời hạn (vd: hóa đơn điện tử). */
  expirationDate?: string | null;
  staffName?: string;
  /** Chỉ áp dụng khi tên dịch vụ thuộc "Hóa đơn điện tử" (xem isInvoicePortalService). */
  invoicePortalUrl?: string | null;
  invoicePortalUsername?: string | null;
  /** Plaintext nhập từ form; server mã hóa trước khi lưu, không bao giờ lưu nguyên văn. */
  invoicePortalPassword?: string | null;
}

/**
 * Kiểm tra + chuẩn hóa 3 trường thông tin đăng nhập hệ thống hóa đơn.
 * Quy tắc: có mật khẩu thì bắt buộc có tài khoản; link phải là URL hợp lệ nếu nhập.
 * Trả về các cột cần ghi DB (password đã mã hóa hoặc "không đổi"/"xóa").
 */
function resolveInvoiceCredentialWrite(
  input: Pick<CreateServiceInput, "invoicePortalUrl" | "invoicePortalUsername" | "invoicePortalPassword">,
  current: { url: string | null; username: string | null; passwordEnc: string | null }
): { url: string | null; username: string | null; passwordEnc: string | null } {
  const urlTouched = input.invoicePortalUrl !== undefined;
  const usernameTouched = input.invoicePortalUsername !== undefined;
  const passwordTouched = input.invoicePortalPassword !== undefined;

  const url = urlTouched ? (input.invoicePortalUrl ? String(input.invoicePortalUrl).trim() : null) : current.url;
  const username = usernameTouched
    ? input.invoicePortalUsername
      ? String(input.invoicePortalUsername).trim()
      : null
    : current.username;

  let passwordEnc = current.passwordEnc;
  if (passwordTouched) {
    const plain = input.invoicePortalPassword ? String(input.invoicePortalPassword) : "";
    passwordEnc = plain ? encryptInvoicePassword(plain) : null;
  }

  if (url && !isValidHttpUrl(url)) {
    throw new ServiceServiceError("Link hệ thống hóa đơn không hợp lệ (phải là URL http/https)", 400);
  }
  if (passwordEnc && !username) {
    throw new ServiceServiceError("Đã nhập mật khẩu thì phải nhập Tài khoản đăng nhập", 400);
  }

  return { url, username, passwordEnc };
}

export class ServiceService {
  async getAll(filters: { staff?: string; expiringWithinDays?: number }): Promise<ServiceRecordDto[]> {
    let sql = `${SERVICE_SELECT} WHERE s.archived_at IS NULL`;
    const params: any[] = [];

    if (filters.staff && filters.staff !== "all") {
      sql += " AND s.staff_name = ?";
      params.push(filters.staff);
    }

    sql += " ORDER BY s.expiration_date ASC";
    const rows = await query<ServiceRow>(sql, params);
    let records = rows.map(toServiceRecord);

    if (typeof filters.expiringWithinDays === "number" && !Number.isNaN(filters.expiringWithinDays)) {
      records = records.filter((r) => r.daysRemaining !== null && r.daysRemaining <= filters.expiringWithinDays!);
    }

    return records;
  }

  async listByCustomer(customerId: string): Promise<ServiceRecordDto[]> {
    const rows = await query<ServiceRow>(
      `${SERVICE_SELECT} WHERE s.customer_id = ? ORDER BY s.expiration_date ASC`,
      [customerId]
    );
    return rows.map(toServiceRecord);
  }

  async create(input: CreateServiceInput, scope: string | null = null): Promise<ServiceRecordDto> {
    if (!isValidServiceGroup(input.serviceGroup)) {
      throw new ServiceServiceError("Nhóm dịch vụ không hợp lệ", 400);
    }
    if (!isValidPaymentType(input.paymentType)) {
      throw new ServiceServiceError("Hình thức thanh toán không hợp lệ", 400);
    }
    if (!input.serviceName || !input.serviceName.trim()) {
      throw new ServiceServiceError("Tên dịch vụ không được để trống", 400);
    }
    if (!input.startDate) {
      throw new ServiceServiceError("Vui lòng nhập ngày bắt đầu", 400);
    }
    if (input.expirationDate && input.expirationDate < input.startDate) {
      throw new ServiceServiceError("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu", 400);
    }

    const customerRows = await query<any>("SELECT * FROM customers WHERE id = ?", [input.customerId]);
    if (customerRows.length === 0) {
      throw new ServiceServiceError("Không tìm thấy khách hàng", 404);
    }
    const customer = customerRows[0];

    if (scope !== null) {
      if (customer.am_caring_staff !== scope && customer.am_staff !== scope) {
        throw new ServiceServiceError("Bạn chỉ được thêm dịch vụ cho khách hàng do mình phụ trách", 403);
      }
      if (input.staffName && input.staffName !== scope) {
        throw new ServiceServiceError("Bạn chỉ được gán dịch vụ cho chính mình", 403);
      }
    }

    const id = `SRV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const staffName = scope ?? (input.staffName || customer.am_caring_staff || customer.am_staff || "");

    const invoiceCredential = isInvoicePortalService(input.serviceName)
      ? resolveInvoiceCredentialWrite(input, { url: null, username: null, passwordEnc: null })
      : { url: null, username: null, passwordEnc: null };

    await run(
      `INSERT INTO services (
        id, customer_name, service_name, service_code, start_date, expiration_date, staff_name,
        customer_id, service_group, package_name, payment_type,
        invoice_portal_url, invoice_portal_username, invoice_portal_password_enc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        customer.name,
        input.serviceName.trim(),
        input.serviceCode || "",
        input.startDate,
        input.expirationDate ?? null,
        staffName,
        input.customerId,
        input.serviceGroup,
        input.packageName || null,
        input.paymentType,
        invoiceCredential.url,
        invoiceCredential.username,
        invoiceCredential.passwordEnc,
      ]
    );

    await refreshCustomerSummary(input.customerId);

    const rows = await query<ServiceRow>(`${SERVICE_SELECT} WHERE s.id = ?`, [id]);
    return toServiceRecord(rows[0]);
  }

  async update(
    id: string,
    patch: Partial<CreateServiceInput>,
    scope: string | null = null
  ): Promise<ServiceRecordDto> {
    const existingRows = await query<ServiceRow>(`${SERVICE_SELECT} WHERE s.id = ?`, [id]);
    if (existingRows.length === 0) {
      throw new ServiceServiceError("Không tìm thấy dịch vụ", 404);
    }
    const existing = existingRows[0];
    if (existing.contract_id) {
      throw new ServiceServiceError(contractLinkedMessage(existing), 400);
    }

    if (scope !== null) {
      if (existing.staff_name !== scope) {
        throw new ServiceServiceError("Bạn chỉ được sửa dịch vụ do mình phụ trách", 403);
      }
      if (patch.staffName !== undefined && patch.staffName !== scope) {
        throw new ServiceServiceError("Bạn chỉ được gán dịch vụ cho chính mình", 403);
      }
      if (patch.customerId !== undefined && patch.customerId !== existing.customer_id) {
        const target = await query<{ am_staff: string | null; am_caring_staff: string | null }>(
          "SELECT am_staff, am_caring_staff FROM customers WHERE id = ?",
          [patch.customerId]
        );
        if (!target.length || (target[0].am_caring_staff !== scope && target[0].am_staff !== scope)) {
          throw new ServiceServiceError("Bạn chỉ được chuyển dịch vụ sang khách hàng do mình phụ trách", 403);
        }
      }
    }

    if (patch.serviceGroup !== undefined && !isValidServiceGroup(patch.serviceGroup)) {
      throw new ServiceServiceError("Nhóm dịch vụ không hợp lệ", 400);
    }
    if (patch.paymentType !== undefined && !isValidPaymentType(patch.paymentType)) {
      throw new ServiceServiceError("Hình thức thanh toán không hợp lệ", 400);
    }

    const startDate = patch.startDate ?? existing.start_date;
    // "expirationDate" in patch: phân biệt "không gửi field này" (undefined, giữ nguyên)
    // với "gửi null" (chủ động xóa thời hạn, chuyển dịch vụ thành không có thời hạn).
    const expirationDate = "expirationDate" in patch ? (patch.expirationDate ?? null) : existing.expiration_date;
    if (expirationDate && expirationDate < startDate) {
      throw new ServiceServiceError("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu", 400);
    }

    type PlainField = Exclude<
      keyof CreateServiceInput,
      "invoicePortalUrl" | "invoicePortalUsername" | "invoicePortalPassword"
    >;
    const fieldMap: Record<PlainField, string> = {
      customerId: "customer_id",
      serviceGroup: "service_group",
      serviceName: "service_name",
      packageName: "package_name",
      serviceCode: "service_code",
      paymentType: "payment_type",
      startDate: "start_date",
      expirationDate: "expiration_date",
      staffName: "staff_name",
    };

    const sets: string[] = [];
    const params: any[] = [];
    for (const [key, column] of Object.entries(fieldMap) as [PlainField, string][]) {
      if (key in patch) {
        sets.push(`${column} = ?`);
        params.push((patch as any)[key] ?? null);
      }
    }

    const nextServiceName = patch.serviceName !== undefined ? patch.serviceName : existing.service_name;
    if (
      isInvoicePortalService(nextServiceName) &&
      (patch.invoicePortalUrl !== undefined ||
        patch.invoicePortalUsername !== undefined ||
        patch.invoicePortalPassword !== undefined)
    ) {
      const invoiceCredential = resolveInvoiceCredentialWrite(patch, {
        url: existing.invoice_portal_url ?? null,
        username: existing.invoice_portal_username ?? null,
        passwordEnc: existing.invoice_portal_password_enc ?? null,
      });
      sets.push("invoice_portal_url = ?", "invoice_portal_username = ?", "invoice_portal_password_enc = ?");
      params.push(invoiceCredential.url, invoiceCredential.username, invoiceCredential.passwordEnc);
    } else if (
      !isInvoicePortalService(nextServiceName) &&
      (existing.invoice_portal_url || existing.invoice_portal_username || existing.invoice_portal_password_enc)
    ) {
      // Đổi tên dịch vụ ra khỏi nhóm "Hóa đơn điện tử": xóa luôn thông tin đăng nhập cũ để không treo dữ liệu nhạy cảm không còn dùng.
      sets.push("invoice_portal_url = ?", "invoice_portal_username = ?", "invoice_portal_password_enc = ?");
      params.push(null, null, null);
    }

    if (sets.length > 0) {
      params.push(id);
      await run(`UPDATE services SET ${sets.join(", ")} WHERE id = ?`, params);
    }

    const affectedCustomerId = patch.customerId ?? existing.customer_id;
    if (affectedCustomerId) {
      await refreshCustomerSummary(affectedCustomerId);
    }

    const rows = await query<ServiceRow>(`${SERVICE_SELECT} WHERE s.id = ?`, [id]);
    return toServiceRecord(rows[0]);
  }

  /**
   * "Xóa" dịch vụ = soft delete (đánh archived_at), KHÔNG DELETE thật — dữ liệu dịch vụ
   * của khách hàng không bị giảm/mất, chỉ ẩn khỏi trang "Dịch vụ & Cảnh báo"/nhắc hẹn.
   */
  async remove(id: string): Promise<void> {
    const rows = await query<ServiceRow>(`${SERVICE_SELECT} WHERE s.id = ?`, [id]);
    if (rows.length === 0) {
      throw new ServiceServiceError("Không tìm thấy dịch vụ", 404);
    }
    if (rows[0].contract_id) {
      throw new ServiceServiceError(contractLinkedMessage(rows[0]), 400);
    }
    const customerId = rows[0].customer_id;

    await run("UPDATE services SET archived_at = ? WHERE id = ?", [new Date().toISOString(), id]);

    if (customerId) {
      await refreshCustomerSummary(customerId);
    }
  }

  /**
   * Chỉ Admin: giải mã mật khẩu hệ thống hóa đơn điện tử để xem. Ghi audit log
   * (ai xem, dịch vụ nào, lúc nào) — không bao giờ trả plaintext qua các API khác.
   */
  async revealInvoiceCredential(
    id: string,
    actor: string
  ): Promise<{ url: string | null; username: string | null; password: string | null }> {
    const rows = await query<ServiceRow>(`${SERVICE_SELECT} WHERE s.id = ?`, [id]);
    if (rows.length === 0) {
      throw new ServiceServiceError("Không tìm thấy dịch vụ", 404);
    }
    const row = rows[0];
    if (!isInvoicePortalService(row.service_name)) {
      throw new ServiceServiceError("Dịch vụ này không thuộc nhóm Hóa đơn điện tử", 400);
    }

    const password = row.invoice_portal_password_enc
      ? decryptInvoicePassword(row.invoice_portal_password_enc)
      : null;

    await run(
      "INSERT INTO invoice_credential_audit_logs (id, service_id, action, actor, created_at) VALUES (?, ?, ?, ?, ?)",
      [`ICL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, id, "Xem mật khẩu hóa đơn", actor, new Date().toISOString()]
    );

    return {
      url: row.invoice_portal_url ?? null,
      username: row.invoice_portal_username ?? null,
      password,
    };
  }
}
