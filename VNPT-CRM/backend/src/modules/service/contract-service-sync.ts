import { query, run } from "../../database/db.js";
import { todayVn } from "../../utils/date-vn.js";
import { refreshCustomerSummary, type ServiceDb } from "./service.service.js";

export const DEFAULT_TERM_MONTHS = 12;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const VN_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Chuẩn hóa chuỗi ngày (YYYY-MM-DD hoặc DD/MM/YYYY) về YYYY-MM-DD; không hợp lệ -> null. */
export function normalizeDateIso(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  let y: number;
  let m: number;
  let d: number;
  const iso = ISO_DATE.exec(text);
  const vn = VN_DATE.exec(text);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (vn) {
    [d, m, y] = [Number(vn[1]), Number(vn[2]), Number(vn[3])];
  } else {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Cộng `months` tháng vào ngày YYYY-MM-DD, kẹp về ngày cuối tháng (31/1 + 1 tháng -> 28/2 hoặc 29/2). */
export function addMonthsIso(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(d, daysInMonth(year, month));
  return `${year}-${pad(month)}-${pad(day)}`;
}

interface ContractForSync {
  id: string;
  subscriber_codes: string;
  customer_id: string | null;
  am_staff: string | null;
  service_group: string | null;
  service_name: string | null;
  package_name: string | null;
  payment_method: string | null;
  signed_date: string | null;
  term_months: number | null;
  created_date: string | null;
}

interface CustomerForSync {
  id: string;
  name: string;
  am_staff: string | null;
  am_caring_staff: string | null;
}

interface ExistingService {
  id: string;
  customer_id: string | null;
  service_code: string;
  service_name: string;
  service_group: string | null;
  package_name: string | null;
  payment_type: string | null;
  staff_name: string | null;
}

interface ServiceLineItem {
  id: string;
  subscriber_code: string | null;
  service_name: string | null;
  service_group: string | null;
  package_name: string | null;
}

function parseCodes(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  for (const item of parsed) {
    const code = String(item ?? "").trim();
    if (code) seen.add(code);
  }
  return Array.from(seen);
}

/**
 * Đồng bộ danh sách "Dịch vụ - Mã thuê bao" của khách theo một đơn hàng: mỗi mã
 * thuê bao trong đơn là một dòng `services` (gắn `contract_id`). Mã đã có ở
 * khách (cùng `service_code`) thì cập nhật dòng đó và liên kết sang đơn; mã bị
 * bỏ khỏi đơn thì xóa dòng đã liên kết với đơn. Cuối cùng cập nhật chuỗi tóm tắt
 * dịch vụ của mọi khách bị ảnh hưởng (khách cũ và khách mới của đơn).
 */
export async function syncServicesFromContract(
  contractId: string,
  db: ServiceDb = { query, run }
): Promise<void> {
  const contractRows = await db.query<ContractForSync>(
    `SELECT id, subscriber_codes, customer_id, am_staff, service_group, service_name,
            package_name, payment_method, signed_date, term_months,
            to_char(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS created_date
     FROM contracts WHERE id = ?`,
    [contractId]
  );
  if (!contractRows.length) return;
  const contract = contractRows[0];

  const linked = await db.query<ExistingService>("SELECT * FROM services WHERE contract_id = ?", [
    contractId,
  ]);
  const affected = new Set<string>();
  for (const s of linked) if (s.customer_id) affected.add(s.customer_id);

  const customerRows = contract.customer_id
    ? await db.query<CustomerForSync>(
        "SELECT id, name, am_staff, am_caring_staff FROM customers WHERE id = ?",
        [contract.customer_id]
      )
    : [];
  const customer = customerRows[0];

  // T8 (STT 10): ưu tiên đọc từng dòng `contract_items` (mỗi dòng dịch vụ một
  // mã thuê bao riêng, có thể có tên dịch vụ/gói cước/nhóm riêng theo dòng).
  // Đơn chưa có dòng nào (chưa migrate / chưa từng qua create-update mới) thì
  // dùng lại đúng cách cũ (subscriber_codes + các cột tóm tắt của đơn).
  const itemRows = customer
    ? await db.query<ServiceLineItem>(
        `SELECT id, subscriber_code, service_name, service_group, package_name
         FROM contract_items WHERE contract_id = ? AND line_type = 'service' ORDER BY line_no`,
        [contractId]
      )
    : [];

  interface LineSource {
    code: string;
    serviceName: string | null;
    serviceGroup: string | null;
    packageName: string | null;
  }

  const lines: LineSource[] = itemRows.length
    ? itemRows
        .filter((i) => i.subscriber_code && i.subscriber_code.trim())
        .map((i) => ({
          code: (i.subscriber_code as string).trim(),
          serviceName: i.service_name ?? null,
          serviceGroup: i.service_group ?? null,
          packageName: i.package_name ?? null,
        }))
    : (customer ? parseCodes(contract.subscriber_codes) : []).map((code) => ({
        code,
        serviceName: null,
        serviceGroup: null,
        packageName: null,
      }));

  const startDate =
    normalizeDateIso(contract.signed_date) ?? normalizeDateIso(contract.created_date) ?? todayVn();
  const term =
    Number.isInteger(Number(contract.term_months)) && Number(contract.term_months) > 0
      ? Number(contract.term_months)
      : DEFAULT_TERM_MONTHS;
  const endDate = addMonthsIso(startDate, term);

  const kept = new Set<string>();

  if (customer) {
    affected.add(customer.id);
    const atCustomer = await db.query<ExistingService>(
      "SELECT * FROM services WHERE customer_id = ?",
      [customer.id]
    );

    for (const line of lines) {
      const code = line.code;
      const target =
        linked.find((s) => s.customer_id === customer.id && s.service_code === code && !kept.has(s.id)) ??
        atCustomer.find((s) => s.service_code === code && !kept.has(s.id)) ??
        linked.find((s) => s.service_code === code && !kept.has(s.id));

      const serviceName =
        line.serviceName?.trim() ||
        contract.service_name?.trim() ||
        contract.package_name?.trim() ||
        target?.service_name ||
        "Dịch vụ";
      const staffName =
        contract.am_staff?.trim() ||
        customer.am_staff?.trim() ||
        customer.am_caring_staff?.trim() ||
        target?.staff_name ||
        "";
      const serviceGroup = line.serviceGroup || contract.service_group || target?.service_group || null;
      const packageName = line.packageName || contract.package_name || target?.package_name || null;
      const paymentType = contract.payment_method || target?.payment_type || null;

      if (target) {
        await db.run(
          `UPDATE services SET
            customer_id = ?, customer_name = ?, service_name = ?, service_group = ?,
            package_name = ?, payment_type = ?, staff_name = ?,
            start_date = ?, expiration_date = ?, contract_id = ?
           WHERE id = ?`,
          [
            customer.id,
            customer.name,
            serviceName,
            serviceGroup,
            packageName,
            paymentType,
            staffName,
            startDate,
            endDate,
            contractId,
            target.id,
          ]
        );
        kept.add(target.id);
      } else {
        const id = `SRV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await db.run(
          `INSERT INTO services (
            id, customer_name, service_name, service_code, start_date, expiration_date, staff_name,
            customer_id, service_group, package_name, payment_type, contract_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            customer.name,
            serviceName,
            code,
            startDate,
            endDate,
            staffName,
            customer.id,
            serviceGroup,
            packageName,
            paymentType,
            contractId,
          ]
        );
        kept.add(id);
      }
    }
  }

  for (const s of linked) {
    if (!kept.has(s.id)) {
      await db.run("DELETE FROM services WHERE id = ?", [s.id]);
    }
  }

  for (const customerId of affected) {
    await refreshCustomerSummary(customerId, db);
  }
}
