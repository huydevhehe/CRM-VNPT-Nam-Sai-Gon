import { query, run, transaction } from "../../database/db.js";
import { CommissionService } from "../commission/commission.service.js";
import {
  SERVICE_GROUPS,
  PAYMENT_METHODS,
  PREPAID_MONTH_OPTIONS,
  PREPAID_PAYMENT_METHOD,
} from "../../constants/org.js";
import { syncServicesFromContract } from "../service/contract-service-sync.js";
import { validateChannelDetail, CTV_CHANNEL } from "../channel-source/channel-source.service.js";
import {
  findContractTemplate,
  CONTRACT_TEMPLATE_REQUIRED_MESSAGE,
  CONTRACT_TEMPLATE_INVALID_MESSAGE,
  CONTRACT_TEMPLATE_REQUIRED_BEFORE_COMPLETE_MESSAGE,
} from "./contract-templates.js";
import {
  normalizeContractItems,
  expandLegacyItems,
  sumAmount,
  replaceContractItems,
  listContractItems,
  listContractItemsForContracts,
  ITEMS_REQUIRED_MESSAGE,
  type ContractItemInput,
  type ContractItemDto,
  type NormalizedContractItem,
} from "./contract-items.js";

const CONTRACT_SELECT = `
  SELECT c.*, cs.name AS channel_source_name
  FROM contracts c
  LEFT JOIN channel_sources cs ON cs.id = c.channel_source_id
`;

export interface ContractRow {
  id: string;
  transaction_code: string;
  customer_name: string;
  subscriber_codes: string;
  total_value: number;
  channel: string;
  deployment_status: string;
  payment_status: string;
  document_status: string;
  has_revenue: number;
  lead_id: string | null;
  territory_id: string | null;
  referred_by_ctv_id: string | null;
  am_staff: string | null;
  service_group: string | null;
  service_name: string | null;
  package_name: string | null;
  payment_method: string | null;
  customer_id: string | null;
  tax_code: string | null;
  contract_number: string | null;
  signed_date: string | null;
  term_months: number | null;
  prepaid_months?: number | null;
  collected_amount: number | null;
  channel_source_id?: string | null;
  channel_source_name?: string | null;
  contract_template?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ContractRecordDto {
  id: string;
  transactionCode: string;
  customerName: string;
  subscriberCodes: string[];
  totalValue: number;
  channel: string;
  deploymentStatus: string;
  paymentStatus: string;
  documentStatus: string;
  hasRevenue: boolean;
  leadId: string | null;
  territoryId: string | null;
  referredByCtvId: string | null;
  amStaff: string | null;
  serviceGroup: string | null;
  serviceName: string | null;
  packageName: string | null;
  paymentMethod: string | null;
  customerId: string | null;
  taxCode: string | null;
  contractNumber: string | null;
  signedDate: string | null;
  termMonths: number | null;
  prepaidMonths: number | null;
  collectedAmount: number;
  channelSourceId: string | null;
  channelSourceName: string | null;
  /** Mẫu hợp đồng (T10, STT 11) — nullable cho đơn cũ, bắt buộc khi tạo mới. */
  contractTemplate: string | null;
  /** Các dòng dịch vụ/thiết bị của đơn (T8, STT 10). */
  items?: ContractItemDto[];
  /**
   * Thông điệp hoa hồng CTV (vd đổi CTV sau khi đã có hoa hồng, hoặc đơn Hoàn tất
   * không có CTV nên không phát sinh). Chỉ có giá trị ngay sau create/update/status,
   * không lưu DB.
   */
  commissionNotice?: string | null;
}

export interface UpdateContractStatusInput {
  deploymentStatus?: string;
  paymentStatus?: string;
  documentStatus?: string;
  totalValue?: number;
}

export interface CreateContractInput {
  transactionCode: string;
  customerName?: string;
  /** Bắt buộc khi không gửi `items` (payload cũ: 1 dịch vụ + mảng mã thuê bao). */
  subscriberCodes?: string[];
  /** Bắt buộc khi không gửi `items`; có `items` thì server tự tính, bỏ qua giá trị này. */
  totalValue?: number;
  channel: string;
  leadId?: string | null;
  territoryId?: string | null;
  amStaff?: string | null;
  serviceGroup?: string | null;
  serviceName?: string | null;
  packageName?: string | null;
  paymentMethod?: string | null;
  customerId?: string | null;
  taxCode?: string | null;
  contractNumber?: string | null;
  signedDate?: string | null;
  termMonths?: number | null;
  prepaidMonths?: number | null;
  /** Chi tiết kênh (nguồn Online / đối tác); kênh "CTV giới thiệu" dùng referredByCtvId. */
  channelSourceId?: string | null;
  referredByCtvId?: string | null;
  /** Mẫu hợp đồng (T10, STT 11) — bắt buộc khi tạo mới. */
  contractTemplate?: string | null;
  /**
   * T8 (STT 10) — nhiều dòng dịch vụ/thiết bị. Khi có, bỏ qua `subscriberCodes`
   * / `serviceGroup` / `serviceName` / `packageName` / `totalValue` (server tự
   * tính lại từ các dòng). Khi không có: payload cũ (1 dịch vụ + mảng mã thuê
   * bao) vẫn được chấp nhận, tự mở rộng thành các dòng tương đương.
   */
  items?: ContractItemInput[];
}

export interface UpdateContractInfoInput {
  subscriberCodes?: string[];
  totalValue?: number;
  channel?: string;
  leadId?: string | null;
  territoryId?: string | null;
  amStaff?: string | null;
  serviceGroup?: string | null;
  serviceName?: string | null;
  packageName?: string | null;
  paymentMethod?: string | null;
  customerId?: string | null;
  taxCode?: string | null;
  contractNumber?: string | null;
  signedDate?: string | null;
  termMonths?: number | null;
  prepaidMonths?: number | null;
  channelSourceId?: string | null;
  referredByCtvId?: string | null;
  /** Mẫu hợp đồng (T10, STT 11) — đơn cũ thiếu mẫu vẫn sửa trường khác được. */
  contractTemplate?: string | null;
  items?: ContractItemInput[];
}

export interface ContractPaymentRow {
  id: string;
  contract_id: string;
  amount: number;
  paid_date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ContractPaymentDto {
  id: string;
  contractId: string;
  amount: number;
  paidDate: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface AddPaymentInput {
  amount: number;
  paidDate?: string;
  note?: string;
}

const DEPLOYMENT_STATUSES = [
  "Chưa triển khai",
  "Đang triển khai",
  "Hoàn tất",
  "Tạm dừng",
  "Hủy",
] as const;
const PAYMENT_STATUSES = ["Chưa thanh toán", "Đã thanh toán"] as const;
const DOCUMENT_STATUSES = ["Soạn thảo", "Khách trình ký", "Hoàn thiện bàn giao"] as const;

function toContractRecord(row: ContractRow): ContractRecordDto {
  let subscriberCodes: string[] = [];
  try {
    const parsed = JSON.parse(row.subscriber_codes);
    subscriberCodes = Array.isArray(parsed) ? parsed : [];
  } catch {
    subscriberCodes = [];
  }

  return {
    id: row.id,
    transactionCode: row.transaction_code,
    customerName: row.customer_name,
    subscriberCodes,
    totalValue: row.total_value,
    channel: row.channel,
    deploymentStatus: row.deployment_status,
    paymentStatus: row.payment_status,
    documentStatus: row.document_status,
    hasRevenue: row.has_revenue === 1,
    leadId: row.lead_id ?? null,
    territoryId: row.territory_id ?? null,
    referredByCtvId: row.referred_by_ctv_id ?? null,
    amStaff: row.am_staff ?? null,
    serviceGroup: row.service_group ?? null,
    serviceName: row.service_name ?? null,
    packageName: row.package_name ?? null,
    paymentMethod: row.payment_method ?? null,
    customerId: row.customer_id ?? null,
    taxCode: row.tax_code ?? null,
    contractNumber: row.contract_number ?? null,
    signedDate: row.signed_date ?? null,
    termMonths: row.term_months ?? null,
    prepaidMonths: row.prepaid_months ?? null,
    collectedAmount: Number(row.collected_amount ?? 0),
    channelSourceId: row.channel_source_id ?? null,
    channelSourceName: row.channel_source_name ?? null,
    contractTemplate: row.contract_template ?? null,
  };
}

const commissionService = new CommissionService();

const TERM_MONTHS_MESSAGE = "Thời hạn phải là số tháng nguyên, từ 1 trở lên";

function parseTermMonths(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(TERM_MONTHS_MESSAGE);
  }
  return n;
}

export const AM_REQUIRED_MESSAGE = "Vui lòng chọn AM phát triển";
export const PREPAID_MONTHS_MESSAGE = `Hình thức Trả trước phải chọn số tháng trả trước: ${PREPAID_MONTH_OPTIONS.join(", ")} tháng`;

/** null nếu để trống; ném lỗi nếu có giá trị nhưng ngoài danh sách 3/6/12/18/24. */
function parsePrepaidMonths(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!(PREPAID_MONTH_OPTIONS as readonly number[]).includes(n)) {
    throw new Error(PREPAID_MONTHS_MESSAGE);
  }
  return n;
}

export const CUSTOMER_REQUIRED_MESSAGE =
  "Vui lòng chọn Khách hàng. Đơn hàng bắt buộc phải gắn với một khách hàng trong hệ thống";

export interface ContractActor {
  role: string;
  name?: string;
}

interface LinkedCustomer {
  id: string;
  name: string;
  identity_code: string | null;
  am_staff: string | null;
  am_caring_staff: string | null;
}

function isAdminActor(actor: ContractActor): boolean {
  return actor.role?.toLowerCase() === "admin";
}

async function resolveRequiredCustomer(
  customerId: unknown,
  actor: ContractActor | undefined,
  enforceScope: boolean
): Promise<LinkedCustomer> {
  const id = typeof customerId === "string" ? customerId.trim() : "";
  if (!id) {
    throw new Error(CUSTOMER_REQUIRED_MESSAGE);
  }

  const rows = await query<LinkedCustomer>(
    "SELECT id, name, identity_code, am_staff, am_caring_staff FROM customers WHERE id = ?",
    [id]
  );
  if (!rows.length) {
    throw new Error("Khách hàng không tồn tại");
  }

  const customer = rows[0];
  if (actor && enforceScope && !isAdminActor(actor)) {
    const actorName = (actor.name || "").trim();
    const isOwner =
      Boolean(actorName) &&
      ((customer.am_staff || "").trim() === actorName ||
        (customer.am_caring_staff || "").trim() === actorName);
    if (!isOwner) {
      throw new Error("Bạn chỉ được gắn đơn hàng với khách hàng mình đang phụ trách");
    }
  }
  return customer;
}

export class ContractForbiddenError extends Error {}
export class ContractNotFoundError extends Error {}
/** Chặn xóa đơn khi đã có hoa hồng CTV đã chi (STT 11, T10). */
export class ContractDeleteBlockedError extends Error {}

export class ContractService {
  /** `scope` = tên AM (không phải Admin): chỉ lấy đơn do AM đó phụ trách. */
  async getAll(scope: string | null = null): Promise<ContractRecordDto[]> {
    const rows =
      scope === null
        ? await query<ContractRow>(`${CONTRACT_SELECT} ORDER BY c.created_at DESC`)
        : await query<ContractRow>(
            `${CONTRACT_SELECT} WHERE c.am_staff = ? ORDER BY c.created_at DESC`,
            [scope]
          );
    const itemsByContract = await listContractItemsForContracts(rows.map((r) => r.id));
    return rows.map((row) => ({ ...toContractRecord(row), items: itemsByContract.get(row.id) ?? [] }));
  }

  async assertCanAccess(id: string, scope: string | null): Promise<void> {
    const rows = await query<{ am_staff: string | null }>(
      "SELECT am_staff FROM contracts WHERE id = ?",
      [id]
    );
    if (!rows.length) {
      throw new Error("Không tìm thấy Hợp đồng");
    }
    if (scope !== null && rows[0].am_staff !== scope) {
      throw new ContractForbiddenError("Không có quyền truy cập đơn hàng này");
    }
  }

  async create(data: CreateContractInput, actor?: ContractActor): Promise<ContractRecordDto> {
    const hasItems = Array.isArray(data.items) && data.items.length > 0;

    if (
      !data.transactionCode ||
      !data.channel ||
      (!hasItems && (!Array.isArray(data.subscriberCodes) || !data.subscriberCodes.length))
    ) {
      throw new Error("Thiếu thông tin bắt buộc để tạo Hợp đồng");
    }

    const customer = await resolveRequiredCustomer(data.customerId, actor, true);
    const termMonths = parseTermMonths(data.termMonths);

    // Khi có `items` (nhiều dòng, STT 10), server tự tính lại tổng tiền từ các
    // dòng — không tin/không bắt buộc `totalValue` của client cho trường hợp này.
    if (!hasItems) {
      if (typeof data.totalValue !== "number" || Number.isNaN(data.totalValue)) {
        throw new Error("Giá trị hợp đồng phải là một số hợp lệ");
      }

      if (data.totalValue < 0) {
        throw new Error("Giá trị hợp đồng không được âm");
      }
    }

    if (
      data.serviceGroup &&
      !SERVICE_GROUPS.includes(data.serviceGroup as (typeof SERVICE_GROUPS)[number])
    ) {
      throw new Error("Nhóm dịch vụ không hợp lệ");
    }

    if (
      data.paymentMethod &&
      !PAYMENT_METHODS.includes(data.paymentMethod as (typeof PAYMENT_METHODS)[number])
    ) {
      throw new Error("Hình thức thanh toán không hợp lệ");
    }

    const paymentMethod = data.paymentMethod ? String(data.paymentMethod) : null;
    let prepaidMonths: number | null = null;
    if (paymentMethod === PREPAID_PAYMENT_METHOD) {
      prepaidMonths = parsePrepaidMonths(data.prepaidMonths);
      if (prepaidMonths === null) throw new Error(PREPAID_MONTHS_MESSAGE);
    }

    // T10 (STT 11): mỗi Mã giao dịch bắt buộc gắn đúng 1 mẫu hợp đồng khi tạo mới.
    const contractTemplate = data.contractTemplate ? String(data.contractTemplate) : "";
    if (!contractTemplate) {
      throw new Error(CONTRACT_TEMPLATE_REQUIRED_MESSAGE);
    }
    if (!findContractTemplate(contractTemplate)) {
      throw new Error(CONTRACT_TEMPLATE_INVALID_MESSAGE);
    }

    let territoryId: string | null = null;
    let referredByCtvId: string | null = null;
    let channelSourceId: string | null = null;
    let amStaff: string | null = data.amStaff ? String(data.amStaff).trim() : null;
    const leadId = data.leadId ? String(data.leadId) : null;

    if (leadId) {
      const lead = await query<{
        territory_id: string | null;
        referred_by_ctv_id: string | null;
        staff_name: string | null;
        channel_source_id: string | null;
      }>(
        "SELECT territory_id, referred_by_ctv_id, staff_name, channel_source_id FROM leads WHERE id = ?",
        [leadId]
      );
      if (!lead.length) {
        throw new Error("Lead không tồn tại");
      }
      territoryId = lead[0].territory_id ?? null;
      referredByCtvId = lead[0].referred_by_ctv_id ?? null;
      channelSourceId = lead[0].channel_source_id ?? null;
      if (!amStaff && lead[0].staff_name) {
        amStaff = lead[0].staff_name;
      }
    }

    // Đơn tạo từ Lead kế thừa kênh + chi tiết kênh/CTV của Lead, nhưng người dùng
    // được sửa trước khi lưu (data.channelSourceId/referredByCtvId nếu có sẽ ghi đè).
    if (data.channelSourceId !== undefined) {
      channelSourceId = data.channelSourceId ? String(data.channelSourceId) : null;
    }
    if (data.referredByCtvId !== undefined) {
      referredByCtvId = data.referredByCtvId ? String(data.referredByCtvId) : null;
    }
    const channelDetail = await validateChannelDetail({
      channel: data.channel,
      channelSourceId,
      referredByCtvId,
    });
    channelSourceId = channelDetail.channelSourceId;
    referredByCtvId = channelDetail.referredByCtvId;

    const selfAssigned = Boolean(actor && !isAdminActor(actor));
    if (actor && selfAssigned) {
      const actorName = (actor.name || "").trim();
      if (amStaff && amStaff !== actorName) {
        throw new ContractForbiddenError("Bạn chỉ được tạo đơn hàng do chính mình phụ trách");
      }
      amStaff = actorName || null;
    }

    if (!amStaff) {
      throw new Error(AM_REQUIRED_MESSAGE);
    }

    if (!selfAssigned) {
      const staffRows = await query<{ id: string }>("SELECT id FROM staff WHERE name = ?", [amStaff]);
      if (!staffRows.length) {
        throw new Error("Nhân viên AM không tồn tại");
      }
    }

    const customerId = customer.id;
    const customerName = customer.name;
    const taxCode: string | null =
      (data.taxCode ? String(data.taxCode).trim() : "") || customer.identity_code || null;

    if (data.territoryId) {
      const territory = await query("SELECT id FROM territories WHERE id = ?", [data.territoryId]);
      if (!territory.length) {
        throw new Error("Phường không tồn tại");
      }
      territoryId = String(data.territoryId);
    }

    // T8 (STT 10): `items` (mới, nhiều dòng) nếu có thì server tự tính lại
    // `totalValue` + các cột tóm tắt; không có thì mở rộng payload cũ (1 dịch
    // vụ + mảng mã thuê bao) thành các dòng tương đương, vẫn ghi cột tóm tắt
    // như cũ để tương thích báo cáo/đề nghị thanh toán đang đọc trực tiếp.
    const normalizedItems = hasItems
      ? normalizeContractItems(data.items as ContractItemInput[])
      : expandLegacyItems({
          subscriberCodes: data.subscriberCodes as string[],
          totalValue: data.totalValue as number,
          serviceGroup: data.serviceGroup,
          serviceName: data.serviceName,
          packageName: data.packageName,
          termMonths,
        });
    const finalTotalValue = hasItems ? sumAmount(normalizedItems) : (data.totalValue as number);
    const finalSubscriberCodes = hasItems
      ? normalizedItems.filter((i) => i.subscriberCode).map((i) => i.subscriberCode as string)
      : data.subscriberCodes;
    const finalServiceGroup = hasItems
      ? normalizedItems.find((i) => i.serviceGroup)?.serviceGroup ?? null
      : data.serviceGroup ?? null;
    const finalServiceName = hasItems
      ? Array.from(new Set(normalizedItems.map((i) => i.serviceName).filter(Boolean))).join("; ") || null
      : data.serviceName ?? null;
    const finalPackageName = hasItems
      ? Array.from(new Set(normalizedItems.map((i) => i.packageName).filter(Boolean))).join("; ") || null
      : data.packageName ?? null;

    const id = `HD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await run(
      `INSERT INTO contracts (
        id, transaction_code, customer_name, subscriber_codes, total_value, channel,
        deployment_status, payment_status, document_status, has_revenue,
        lead_id, territory_id, referred_by_ctv_id,
        am_staff, service_group, service_name, package_name, payment_method,
        customer_id, tax_code, contract_number, signed_date, collected_amount, term_months,
        prepaid_months, channel_source_id, contract_template
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.transactionCode,
        customerName,
        JSON.stringify(finalSubscriberCodes),
        finalTotalValue,
        data.channel,
        "Chưa triển khai",
        "Chưa thanh toán",
        "Soạn thảo",
        0,
        leadId,
        territoryId,
        referredByCtvId,
        amStaff,
        finalServiceGroup,
        finalServiceName,
        finalPackageName,
        paymentMethod,
        customerId,
        taxCode,
        data.contractNumber ?? null,
        data.signedDate ?? null,
        0,
        termMonths,
        prepaidMonths,
        channelSourceId,
        contractTemplate,
      ]
    );

    await replaceContractItems(id, normalizedItems);
    await syncServicesFromContract(id);

    const created = await query<ContractRow>(`${CONTRACT_SELECT} WHERE c.id = ?`, [id]);
    const createdItems = await listContractItems(id);
    return { ...toContractRecord(created[0]), items: createdItems };
  }

  /**
   * Khi đơn chuyển "Hoàn tất": có CTV giới thiệu -> sinh hoa hồng chi kênh (nếu
   * chưa có); không có CTV -> sinh hoa hồng nội bộ cho AM bán hàng (nếu chưa
   * có). Nếu đơn đã có hoa hồng (của CTV khác, do đổi CTV sau khi Hoàn tất)
   * thì KHÔNG tự ghi đè, chỉ trả thông điệp để FE hiển thị.
   */
  private async applyCommissionTransition(
    contractId: string,
    deploymentStatus: string,
    referredByCtvId: string | null,
    transactionCode: string,
    totalValue: number,
    amStaff: string | null
  ): Promise<string | null> {
    if (deploymentStatus !== "Hoàn tất") {
      return null;
    }

    const existingCommissions = await query<{ ctv_id: string | null }>(
      "SELECT ctv_id FROM commissions WHERE contract_id = ?",
      [contractId]
    );

    if (!referredByCtvId) {
      if (existingCommissions.some((c) => c.ctv_id === null)) {
        return null;
      }
      await commissionService.createForContract({
        id: contractId,
        transaction_code: transactionCode,
        total_value: totalValue,
        referred_by_ctv_id: null,
        am_staff: amStaff,
      });
      return null;
    }

    // Chỉ xét các dòng hoa hồng CTV (ctv_id khác null) khi quyết định có tạo
    // thêm hay không — 1 dòng hoa hồng nội bộ có sẵn (do lúc Hoàn tất chưa có
    // CTV) không chặn việc sinh hoa hồng CTV khi CTV được gán sau đó.
    const existingCtvCommissions = existingCommissions.filter((c) => c.ctv_id !== null);
    if (!existingCtvCommissions.length) {
      await commissionService.createForContract({
        id: contractId,
        transaction_code: transactionCode,
        total_value: totalValue,
        referred_by_ctv_id: referredByCtvId,
      });
      return null;
    }
    if (existingCtvCommissions.some((c) => c.ctv_id === referredByCtvId)) {
      return null;
    }
    return "Hợp đồng đã có hoa hồng CTV khác, hệ thống không tự tạo thêm khi đổi CTV. Vui lòng xử lý tay nếu cần.";
  }

  async updateStatus(id: string, patch: UpdateContractStatusInput): Promise<ContractRecordDto> {
    const existing = await query<ContractRow>("SELECT * FROM contracts WHERE id = ?", [id]);
    if (!existing.length) {
      throw new Error("Không tìm thấy Hợp đồng");
    }

    if (
      patch.deploymentStatus === undefined &&
      patch.paymentStatus === undefined &&
      patch.documentStatus === undefined &&
      patch.totalValue === undefined
    ) {
      throw new Error("Thiếu thông tin cần cập nhật");
    }

    if (patch.totalValue !== undefined) {
      if (typeof patch.totalValue !== "number" || Number.isNaN(patch.totalValue)) {
        throw new Error("Giá trị hợp đồng phải là một số hợp lệ");
      }
      if (patch.totalValue < 0) {
        throw new Error("Giá trị hợp đồng không được âm");
      }
    }

    if (
      patch.deploymentStatus !== undefined &&
      !DEPLOYMENT_STATUSES.includes(patch.deploymentStatus as (typeof DEPLOYMENT_STATUSES)[number])
    ) {
      throw new Error("Trạng thái không hợp lệ");
    }

    if (
      patch.paymentStatus !== undefined &&
      !PAYMENT_STATUSES.includes(patch.paymentStatus as (typeof PAYMENT_STATUSES)[number])
    ) {
      throw new Error("Trạng thái không hợp lệ");
    }

    if (
      patch.documentStatus !== undefined &&
      !DOCUMENT_STATUSES.includes(patch.documentStatus as (typeof DOCUMENT_STATUSES)[number])
    ) {
      throw new Error("Trạng thái không hợp lệ");
    }

    const current = existing[0];
    const nextDeploymentStatus = patch.deploymentStatus ?? current.deployment_status;
    const nextPaymentStatus = patch.paymentStatus ?? current.payment_status;
    const nextDocumentStatus = patch.documentStatus ?? current.document_status;
    const nextTotalValue = patch.totalValue ?? current.total_value;

    // T10 (STT 11): đơn cũ thiếu mẫu hợp đồng vẫn mở/sửa được, nhưng phải chọn
    // mẫu trước khi chuyển "Hoàn tất".
    if (nextDeploymentStatus === "Hoàn tất" && !current.contract_template) {
      throw new Error(CONTRACT_TEMPLATE_REQUIRED_BEFORE_COMPLETE_MESSAGE);
    }

    await run(
      `UPDATE contracts SET
        deployment_status = ?,
        payment_status = ?,
        document_status = ?,
        total_value = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [nextDeploymentStatus, nextPaymentStatus, nextDocumentStatus, nextTotalValue, id]
    );

    if (patch.totalValue !== undefined) {
      await commissionService.recalculateForContract(id, nextTotalValue);
    }

    const commissionNotice = await this.applyCommissionTransition(
      id,
      nextDeploymentStatus,
      current.referred_by_ctv_id,
      current.transaction_code,
      nextTotalValue,
      current.am_staff
    );

    const updated = await query<ContractRow>(`${CONTRACT_SELECT} WHERE c.id = ?`, [id]);
    return { ...toContractRecord(updated[0]), commissionNotice };
  }

  async updateInfo(
    id: string,
    patch: UpdateContractInfoInput,
    actor: ContractActor
  ): Promise<ContractRecordDto> {
    const existing = await query<ContractRow>("SELECT * FROM contracts WHERE id = ?", [id]);
    if (!existing.length) {
      throw new Error("Không tìm thấy Hợp đồng");
    }

    const current = existing[0];
    const isAdmin = actor.role?.toLowerCase() === "admin";
    const isOwner = Boolean(actor.name && current.am_staff && actor.name === current.am_staff);

    if (!isAdmin && !isOwner) {
      throw new Error("Không có quyền chỉnh sửa đơn hàng này");
    }

    if (!isAdmin && patch.amStaff !== undefined && patch.amStaff !== actor.name) {
      throw new ContractForbiddenError("Chỉ Admin được đổi AM phụ trách đơn hàng");
    }

    if (
      patch.serviceGroup &&
      !SERVICE_GROUPS.includes(patch.serviceGroup as (typeof SERVICE_GROUPS)[number])
    ) {
      throw new Error("Nhóm dịch vụ không hợp lệ");
    }

    if (
      patch.paymentMethod &&
      !PAYMENT_METHODS.includes(patch.paymentMethod as (typeof PAYMENT_METHODS)[number])
    ) {
      throw new Error("Hình thức thanh toán không hợp lệ");
    }

    if (patch.totalValue !== undefined) {
      if (typeof patch.totalValue !== "number" || Number.isNaN(patch.totalValue)) {
        throw new Error("Giá trị hợp đồng phải là một số hợp lệ");
      }
      if (patch.totalValue < 0) {
        throw new Error("Giá trị hợp đồng không được âm");
      }
    }

    const nextTermMonths =
      patch.termMonths !== undefined ? parseTermMonths(patch.termMonths) : current.term_months;

    let amStaff = patch.amStaff !== undefined ? patch.amStaff : current.am_staff;
    amStaff = amStaff ? String(amStaff).trim() : null;
    if (!amStaff) {
      // Đơn cũ thiếu AM vẫn mở được, nhưng muốn lưu thì phải chọn AM phát triển.
      throw new Error(AM_REQUIRED_MESSAGE);
    }
    {
      const staffRows = await query<{ id: string }>("SELECT id FROM staff WHERE name = ?", [amStaff]);
      if (!staffRows.length) {
        throw new Error("Nhân viên AM không tồn tại");
      }
    }

    const customerChanged =
      patch.customerId !== undefined && (patch.customerId ?? "") !== (current.customer_id ?? "");
    const requestedCustomerId = patch.customerId !== undefined ? patch.customerId : current.customer_id;
    const customer = await resolveRequiredCustomer(requestedCustomerId, actor, customerChanged);
    const customerId = customer.id;
    const nextCustomerName = customer.name;

    let taxCode: string | null;
    if (patch.taxCode !== undefined) {
      taxCode = (patch.taxCode ? String(patch.taxCode).trim() : "") || customer.identity_code || null;
    } else if (customerChanged) {
      taxCode = customer.identity_code || (current.customer_id ? null : current.tax_code) || null;
    } else {
      taxCode = current.tax_code || customer.identity_code || null;
    }

    const nextSubscriberCodes = patch.subscriberCodes
      ? JSON.stringify(patch.subscriberCodes)
      : current.subscriber_codes;
    const nextTotalValue = patch.totalValue ?? current.total_value;
    const nextChannel = patch.channel ?? current.channel;
    const nextServiceGroup = patch.serviceGroup !== undefined ? patch.serviceGroup : current.service_group;
    const nextServiceName = patch.serviceName !== undefined ? patch.serviceName : current.service_name;
    const nextPackageName = patch.packageName !== undefined ? patch.packageName : current.package_name;
    const nextPaymentMethod =
      patch.paymentMethod !== undefined ? patch.paymentMethod || null : current.payment_method;

    // Số tháng trả trước: chỉ bắt buộc khi đổi sang "Trả trước" hoặc đã có số tháng;
    // đơn cũ "Trả trước" chưa có số tháng vẫn lưu được các trường khác.
    let nextPrepaidMonths: number | null = null;
    if (nextPaymentMethod === PREPAID_PAYMENT_METHOD) {
      const methodTouched =
        patch.paymentMethod !== undefined && nextPaymentMethod !== current.payment_method;
      const currentPrepaid = current.prepaid_months ?? null;
      if (patch.prepaidMonths !== undefined) {
        const parsed = parsePrepaidMonths(patch.prepaidMonths);
        if (parsed === null && (methodTouched || currentPrepaid !== null)) {
          throw new Error(PREPAID_MONTHS_MESSAGE);
        }
        nextPrepaidMonths = parsed;
      } else {
        if (methodTouched) throw new Error(PREPAID_MONTHS_MESSAGE);
        nextPrepaidMonths = currentPrepaid;
      }
    }
    const nextContractNumber = patch.contractNumber !== undefined ? patch.contractNumber : current.contract_number;
    const nextSignedDate = patch.signedDate !== undefined ? patch.signedDate : current.signed_date;

    // T10 (STT 11): nếu có đụng tới mẫu hợp đồng thì phải là mẫu hợp lệ trong
    // danh sách (được phép để trống để giữ nguyên hành vi "đơn cũ thiếu mẫu").
    let nextContractTemplate = current.contract_template ?? null;
    if (patch.contractTemplate !== undefined) {
      const value = patch.contractTemplate ? String(patch.contractTemplate) : "";
      if (value && !findContractTemplate(value)) {
        throw new Error(CONTRACT_TEMPLATE_INVALID_MESSAGE);
      }
      nextContractTemplate = value || null;
    }

    // Kênh + chi tiết kênh: chỉ chạy lại validate khi thực sự đụng tới kênh/CTV/nguồn
    // (giữ "—" cho dữ liệu cũ chưa có chi tiết khi chỉ sửa trường khác).
    const channelTouched =
      patch.channel !== undefined || patch.channelSourceId !== undefined || patch.referredByCtvId !== undefined;
    let nextChannelSourceId = current.channel_source_id ?? null;
    let nextReferredByCtvId = current.referred_by_ctv_id ?? null;
    if (channelTouched) {
      const channelChanged = nextChannel !== current.channel;
      const sourceId =
        patch.channelSourceId !== undefined
          ? patch.channelSourceId
            ? String(patch.channelSourceId)
            : null
          : channelChanged
            ? null
            : current.channel_source_id ?? null;
      const ctvId =
        patch.referredByCtvId !== undefined
          ? patch.referredByCtvId
            ? String(patch.referredByCtvId)
            : null
          : channelChanged
            ? null
            : current.referred_by_ctv_id ?? null;
      const detail = await validateChannelDetail(
        { channel: nextChannel, channelSourceId: sourceId, referredByCtvId: ctvId },
        { keepInactiveSourceId: current.channel_source_id ?? null, keepCtvId: current.referred_by_ctv_id ?? null }
      );
      nextChannelSourceId = detail.channelSourceId;
      nextReferredByCtvId = detail.referredByCtvId;
    }

    // T8 (STT 10): nếu client gửi `items` (nhiều dòng) thì đó là nguồn sự thật
    // mới, server tự tính lại tổng tiền + cột tóm tắt từ các dòng. Nếu không,
    // giữ hành vi cũ (sửa trực tiếp các cột tóm tắt) nhưng vẫn đồng bộ lại
    // `contract_items` từ các cột đó mỗi khi chúng thay đổi, để dòng dữ liệu
    // luôn khớp cột tóm tắt.
    const itemsTouched = Array.isArray(patch.items) && patch.items.length > 0;
    const legacyFieldsTouched =
      patch.subscriberCodes !== undefined ||
      patch.totalValue !== undefined ||
      patch.serviceGroup !== undefined ||
      patch.serviceName !== undefined ||
      patch.packageName !== undefined;

    let finalSubscriberCodesJson = nextSubscriberCodes;
    let finalTotalValue = nextTotalValue;
    let finalServiceGroup = nextServiceGroup;
    let finalServiceName = nextServiceName;
    let finalPackageName = nextPackageName;
    let itemsToSync: NormalizedContractItem[] | null = null;
    let itemsLegacyFlag = false;

    if (itemsTouched) {
      const normalized = normalizeContractItems(patch.items as ContractItemInput[]);
      finalTotalValue = sumAmount(normalized);
      finalSubscriberCodesJson = JSON.stringify(
        normalized.filter((i) => i.subscriberCode).map((i) => i.subscriberCode)
      );
      finalServiceGroup = normalized.find((i) => i.serviceGroup)?.serviceGroup ?? null;
      finalServiceName =
        Array.from(new Set(normalized.map((i) => i.serviceName).filter(Boolean))).join("; ") || null;
      finalPackageName =
        Array.from(new Set(normalized.map((i) => i.packageName).filter(Boolean))).join("; ") || null;
      itemsToSync = normalized;
    } else if (legacyFieldsTouched) {
      let codes: string[] = [];
      try {
        const parsed = JSON.parse(nextSubscriberCodes);
        if (Array.isArray(parsed)) {
          codes = parsed.map((c) => String(c ?? "").trim()).filter(Boolean);
        }
      } catch {
        codes = [];
      }
      if (codes.length > 0) {
        itemsToSync = expandLegacyItems({
          subscriberCodes: codes,
          totalValue: nextTotalValue,
          serviceGroup: nextServiceGroup,
          serviceName: nextServiceName,
          packageName: nextPackageName,
          termMonths: nextTermMonths,
        });
      } else if (patch.subscriberCodes !== undefined) {
        // Người dùng chủ động xóa hết mã thuê bao -> không hợp lệ, đơn phải có
        // ít nhất một dòng (khác với đơn cũ trước T8 vốn đã không có mã nào).
        throw new Error(ITEMS_REQUIRED_MESSAGE);
      } else {
        // Đơn cũ không có mã thuê bao nào (dữ liệu trước T8): vẫn cho sửa các
        // trường khác, chỉ đồng bộ lại 1 dòng không mã đánh dấu legacy.
        const amount = Math.round(Number(nextTotalValue) || 0);
        itemsToSync = [
          {
            lineNo: 1,
            lineType: "service",
            serviceGroup: nextServiceGroup ?? null,
            serviceName: nextServiceName ?? null,
            packageName: nextPackageName ?? null,
            subscriberCode: null,
            quantity: 1,
            unitPrice: amount,
            amount,
            termMonths: nextTermMonths ?? null,
            startDate: null,
            note: "Tách tự động từ đơn cũ",
          },
        ];
        itemsLegacyFlag = true;
      }
    }

    await run(
      `UPDATE contracts SET
        customer_name = ?,
        subscriber_codes = ?,
        total_value = ?,
        channel = ?,
        channel_source_id = ?,
        referred_by_ctv_id = ?,
        am_staff = ?,
        service_group = ?,
        service_name = ?,
        package_name = ?,
        payment_method = ?,
        customer_id = ?,
        tax_code = ?,
        contract_number = ?,
        signed_date = ?,
        term_months = ?,
        prepaid_months = ?,
        contract_template = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        nextCustomerName,
        finalSubscriberCodesJson,
        finalTotalValue,
        nextChannel,
        nextChannelSourceId,
        nextReferredByCtvId,
        amStaff,
        finalServiceGroup,
        finalServiceName,
        finalPackageName,
        nextPaymentMethod,
        customerId,
        taxCode,
        nextContractNumber,
        nextSignedDate,
        nextTermMonths,
        nextPrepaidMonths,
        nextContractTemplate,
        id,
      ]
    );

    if (itemsToSync) {
      await replaceContractItems(id, itemsToSync, { legacy: itemsLegacyFlag });
    }
    await syncServicesFromContract(id);

    const totalValueChanged = finalTotalValue !== current.total_value;
    if (totalValueChanged) {
      await commissionService.recalculateForContract(id, finalTotalValue);
    }

    // Đổi/thêm CTV sau khi đơn đã Hoàn tất: sinh hoa hồng nếu chưa có, không ghi
    // đè nếu đã có (có thể của CTV cũ) — chỉ báo thông điệp.
    const commissionNotice =
      channelTouched && nextReferredByCtvId !== (current.referred_by_ctv_id ?? null)
        ? await this.applyCommissionTransition(
            id,
            current.deployment_status,
            nextReferredByCtvId,
            current.transaction_code,
            finalTotalValue,
            amStaff
          )
        : null;

    const updated = await query<ContractRow>(`${CONTRACT_SELECT} WHERE c.id = ?`, [id]);
    const updatedItems = await listContractItems(id);
    return { ...toContractRecord(updated[0]), items: updatedItems, commissionNotice };
  }

  async addPayment(
    contractId: string,
    input: AddPaymentInput,
    actorName: string
  ): Promise<ContractRecordDto> {
    const existing = await query<ContractRow>("SELECT * FROM contracts WHERE id = ?", [contractId]);
    if (!existing.length) {
      throw new Error("Không tìm thấy Hợp đồng");
    }

    if (typeof input.amount !== "number" || Number.isNaN(input.amount) || input.amount <= 0) {
      throw new Error("Số tiền thu phải lớn hơn 0");
    }

    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    const paidDate = input.paidDate ? input.paidDate.trim() : todayStr;
    const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();

    await run(
      `INSERT INTO contract_payments (id, contract_id, amount, paid_date, note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [paymentId, contractId, input.amount, paidDate, input.note ?? null, actorName, nowIso]
    );

    // Sum all payments
    const sumRows = await query<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM contract_payments WHERE contract_id = ?",
      [contractId]
    );
    const collectedAmount = Number(sumRows[0]?.total ?? 0);
    const contract = existing[0];

    const nextPaymentStatus =
      collectedAmount >= contract.total_value ? "Đã thanh toán" : contract.payment_status;

    await run(
      `UPDATE contracts SET collected_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [collectedAmount, nextPaymentStatus, contractId]
    );

    const updated = await query<ContractRow>("SELECT * FROM contracts WHERE id = ?", [contractId]);
    return toContractRecord(updated[0]);
  }

  async listPayments(contractId: string): Promise<ContractPaymentDto[]> {
    const rows = await query<ContractPaymentRow>(
      "SELECT * FROM contract_payments WHERE contract_id = ? ORDER BY paid_date ASC, created_at ASC",
      [contractId]
    );
    return rows.map((r) => ({
      id: r.id,
      contractId: r.contract_id,
      amount: Number(r.amount),
      paidDate: r.paid_date,
      note: r.note ?? null,
      createdBy: r.created_by ?? null,
      createdAt: r.created_at,
    }));
  }

  async deletePayment(paymentId: string): Promise<ContractRecordDto> {
    const paymentRows = await query<ContractPaymentRow>(
      "SELECT * FROM contract_payments WHERE id = ?",
      [paymentId]
    );
    if (!paymentRows.length) {
      throw new Error("Không tìm thấy lần thu tiền");
    }

    const contractId = paymentRows[0].contract_id;
    await run("DELETE FROM contract_payments WHERE id = ?", [paymentId]);

    const sumRows = await query<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM contract_payments WHERE contract_id = ?",
      [contractId]
    );
    const collectedAmount = Number(sumRows[0]?.total ?? 0);

    const contractRows = await query<ContractRow>("SELECT * FROM contracts WHERE id = ?", [contractId]);
    const contract = contractRows[0];
    const nextPaymentStatus =
      collectedAmount >= contract.total_value ? "Đã thanh toán" : "Chưa thanh toán";

    await run(
      `UPDATE contracts SET collected_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [collectedAmount, nextPaymentStatus, contractId]
    );

    const updated = await query<ContractRow>("SELECT * FROM contracts WHERE id = ?", [contractId]);
    return toContractRecord(updated[0]);
  }

  /**
   * Xóa Đơn hàng (T10, STT 11) — chỉ Admin (chặn quyền ở controller). Xóa cùng
   * transaction các dòng dịch vụ/thiết bị (`contract_items` cascade qua FK),
   * dịch vụ sinh ra, lịch sử thu tiền, lịch sử xuất đề nghị thanh toán, hoa
   * hồng CHƯA chi. Chặn 409 khi đơn đã có hoa hồng CTV đã được chi (một phần
   * hay toàn bộ) — phải tất toán/xử lý hoa hồng trước khi xóa đơn.
   */
  async deleteContract(id: string, actorName: string): Promise<{
    transactionCode: string;
    itemCount: number;
    paymentCount: number;
  }> {
    const existing = await query<ContractRow>("SELECT * FROM contracts WHERE id = ?", [id]);
    if (!existing.length) {
      throw new ContractNotFoundError("Không tìm thấy Hợp đồng");
    }
    const contract = existing[0];

    const paidCommissions = await query<{ total: number }>(
      "SELECT COALESCE(SUM(paid_out_amount), 0) as total FROM commissions WHERE contract_id = ?",
      [id]
    );
    const totalPaidOut = Number(paidCommissions[0]?.total ?? 0);
    if (totalPaidOut > 0) {
      throw new ContractDeleteBlockedError(
        `Đơn hàng đã có hoa hồng CTV được chi ${totalPaidOut.toLocaleString("vi-VN")} đồng. ` +
          `Vui lòng xử lý/tất toán hoa hồng trước khi xóa đơn.`
      );
    }

    const itemCountRows = await query<{ count: number }>(
      "SELECT COUNT(*) as count FROM contract_items WHERE contract_id = ?",
      [id]
    );
    const paymentCountRows = await query<{ count: number }>(
      "SELECT COUNT(*) as count FROM contract_payments WHERE contract_id = ?",
      [id]
    );

    await transaction(async (tx) => {
      await tx.run("DELETE FROM services WHERE contract_id = ?", [id]);
      await tx.run("DELETE FROM contract_payments WHERE contract_id = ?", [id]);
      await tx.run("DELETE FROM payment_request_exports WHERE contract_id = ?", [id]);
      await tx.run("DELETE FROM commissions WHERE contract_id = ?", [id]);
      // contract_items có ON DELETE CASCADE theo contract_id (xem ext/t8.ts), nhưng
      // xóa rõ ràng để không phụ thuộc hoàn toàn vào ràng buộc FK.
      await tx.run("DELETE FROM contract_items WHERE contract_id = ?", [id]);
      await tx.run("DELETE FROM contracts WHERE id = ?", [id]);
      await tx.run('INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)', [
        `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        actorName,
        "Xóa Đơn hàng",
        `Mã GD ${contract.transaction_code} (id ${id})`,
      ]);
    });

    return {
      transactionCode: contract.transaction_code,
      itemCount: Number(itemCountRows[0]?.count ?? 0),
      paymentCount: Number(paymentCountRows[0]?.count ?? 0),
    };
  }

  /**
   * Báo cáo CHỈ ĐỌC (không tự sinh hàng loạt): liệt kê các đơn đã "Hoàn tất",
   * kênh "CTV giới thiệu" nhưng thiếu `referred_by_ctv_id` — để Admin tự quyết
   * định xử lý tay (gán CTV rồi lưu lại để hệ thống sinh hoa hồng bình thường).
   */
  async getCtvCommissionGaps(): Promise<
    { id: string; transactionCode: string; customerName: string; totalValue: number }[]
  > {
    const rows = await query<{
      id: string;
      transaction_code: string;
      customer_name: string;
      total_value: number;
    }>(
      `SELECT id, transaction_code, customer_name, total_value FROM contracts
       WHERE deployment_status = 'Hoàn tất' AND channel = ?
         AND (referred_by_ctv_id IS NULL OR referred_by_ctv_id = '')
       ORDER BY created_at DESC`,
      [CTV_CHANNEL]
    );
    return rows.map((r) => ({
      id: r.id,
      transactionCode: r.transaction_code,
      customerName: r.customer_name,
      totalValue: Number(r.total_value),
    }));
  }
}
