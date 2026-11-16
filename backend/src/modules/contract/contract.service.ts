import { query, run } from "../../database/db.js";
import { CommissionService } from "../commission/commission.service.js";
import { SERVICE_GROUPS, PAYMENT_METHODS } from "../../constants/org.js";
import { syncServicesFromContract } from "../service/contract-service-sync.js";

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
  collected_amount: number | null;
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
  collectedAmount: number;
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
  subscriberCodes: string[];
  totalValue: number;
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
    collectedAmount: Number(row.collected_amount ?? 0),
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

export class ContractService {
  /** `scope` = tên AM (không phải Admin): chỉ lấy đơn do AM đó phụ trách. */
  async getAll(scope: string | null = null): Promise<ContractRecordDto[]> {
    const rows =
      scope === null
        ? await query<ContractRow>("SELECT * FROM contracts ORDER BY created_at DESC")
        : await query<ContractRow>(
            "SELECT * FROM contracts WHERE am_staff = ? ORDER BY created_at DESC",
            [scope]
          );
    return rows.map(toContractRecord);
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
    if (
      !data.transactionCode ||
      !Array.isArray(data.subscriberCodes) ||
      !data.subscriberCodes.length ||
      !data.channel
    ) {
      throw new Error("Thiếu thông tin bắt buộc để tạo Hợp đồng");
    }

    const customer = await resolveRequiredCustomer(data.customerId, actor, true);
    const termMonths = parseTermMonths(data.termMonths);

    if (typeof data.totalValue !== "number" || Number.isNaN(data.totalValue)) {
      throw new Error("Giá trị hợp đồng phải là một số hợp lệ");
    }

    if (data.totalValue < 0) {
      throw new Error("Giá trị hợp đồng không được âm");
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

    let territoryId: string | null = null;
    let referredByCtvId: string | null = null;
    let amStaff: string | null = data.amStaff ? String(data.amStaff).trim() : null;
    const leadId = data.leadId ? String(data.leadId) : null;

    if (leadId) {
      const lead = await query<{ territory_id: string | null; referred_by_ctv_id: string | null; staff_name: string | null }>(
        "SELECT territory_id, referred_by_ctv_id, staff_name FROM leads WHERE id = ?",
        [leadId]
      );
      if (!lead.length) {
        throw new Error("Lead không tồn tại");
      }
      territoryId = lead[0].territory_id ?? null;
      referredByCtvId = lead[0].referred_by_ctv_id ?? null;
      if (!amStaff && lead[0].staff_name) {
        amStaff = lead[0].staff_name;
      }
    }

    const selfAssigned = Boolean(actor && !isAdminActor(actor));
    if (actor && selfAssigned) {
      const actorName = (actor.name || "").trim();
      if (amStaff && amStaff !== actorName) {
        throw new ContractForbiddenError("Bạn chỉ được tạo đơn hàng do chính mình phụ trách");
      }
      amStaff = actorName || null;
    }

    if (amStaff && !selfAssigned) {
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

    const id = `HD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await run(
      `INSERT INTO contracts (
        id, transaction_code, customer_name, subscriber_codes, total_value, channel,
        deployment_status, payment_status, document_status, has_revenue,
        lead_id, territory_id, referred_by_ctv_id,
        am_staff, service_group, service_name, package_name, payment_method,
        customer_id, tax_code, contract_number, signed_date, collected_amount, term_months
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.transactionCode,
        customerName,
        JSON.stringify(data.subscriberCodes),
        data.totalValue,
        data.channel,
        "Chưa triển khai",
        "Chưa thanh toán",
        "Soạn thảo",
        0,
        leadId,
        territoryId,
        referredByCtvId,
        amStaff,
        data.serviceGroup ?? null,
        data.serviceName ?? null,
        data.packageName ?? null,
        data.paymentMethod ?? null,
        customerId,
        taxCode,
        data.contractNumber ?? null,
        data.signedDate ?? null,
        0,
        termMonths,
      ]
    );

    await syncServicesFromContract(id);

    const created = await query<ContractRow>("SELECT * FROM contracts WHERE id = ?", [id]);
    return toContractRecord(created[0]);
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

    const updated = await query<ContractRow>("SELECT * FROM contracts WHERE id = ?", [id]);
    if (patch.deploymentStatus === "Hoàn tất" && updated[0].referred_by_ctv_id) {
      await commissionService.createForContract(updated[0]);
    }
    return toContractRecord(updated[0]);
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
    if (amStaff) {
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
    const nextPaymentMethod = patch.paymentMethod !== undefined ? patch.paymentMethod : current.payment_method;
    const nextContractNumber = patch.contractNumber !== undefined ? patch.contractNumber : current.contract_number;
    const nextSignedDate = patch.signedDate !== undefined ? patch.signedDate : current.signed_date;

    await run(
      `UPDATE contracts SET
        customer_name = ?,
        subscriber_codes = ?,
        total_value = ?,
        channel = ?,
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
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        nextCustomerName,
        nextSubscriberCodes,
        nextTotalValue,
        nextChannel,
        amStaff,
        nextServiceGroup,
        nextServiceName,
        nextPackageName,
        nextPaymentMethod,
        customerId,
        taxCode,
        nextContractNumber,
        nextSignedDate,
        nextTermMonths,
        id,
      ]
    );

    await syncServicesFromContract(id);

    if (patch.totalValue !== undefined) {
      await commissionService.recalculateForContract(id, nextTotalValue);
    }

    const updated = await query<ContractRow>("SELECT * FROM contracts WHERE id = ?", [id]);
    return toContractRecord(updated[0]);
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
}
