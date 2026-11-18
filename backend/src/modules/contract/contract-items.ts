import { query, run } from "../../database/db.js";

/**
 * Dòng dịch vụ/thiết bị của một đơn hàng (STT 10 — một mã GD có thể có nhiều
 * dịch vụ/gói cước, mỗi dịch vụ 1 mã thuê bao, hoặc mua thiết bị như TOKEN).
 */
export type ContractLineType = "service" | "device";

export interface ContractItemInput {
  lineType: ContractLineType;
  serviceGroup?: string | null;
  serviceName?: string | null;
  packageName?: string | null;
  subscriberCode?: string | null;
  quantity?: number | null;
  unitPrice: number;
  termMonths?: number | null;
  startDate?: string | null;
  note?: string | null;
}

export interface NormalizedContractItem {
  lineNo: number;
  lineType: ContractLineType;
  serviceGroup: string | null;
  serviceName: string | null;
  packageName: string | null;
  subscriberCode: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  termMonths: number | null;
  startDate: string | null;
  note: string | null;
}

export interface ContractItemRow {
  id: string;
  contract_id: string;
  line_no: number;
  line_type: ContractLineType;
  service_group: string | null;
  service_name: string | null;
  package_name: string | null;
  subscriber_code: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
  term_months: number | null;
  start_date: string | null;
  note: string | null;
  legacy: boolean;
  created_at?: string | null;
}

export interface ContractItemDto {
  id: string;
  lineNo: number;
  lineType: ContractLineType;
  serviceGroup: string | null;
  serviceName: string | null;
  packageName: string | null;
  subscriberCode: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  termMonths: number | null;
  startDate: string | null;
  note: string | null;
  legacy: boolean;
}

export const ITEMS_REQUIRED_MESSAGE = "Đơn hàng phải có ít nhất một dòng dịch vụ hoặc thiết bị";
export const LINE_TYPE_INVALID_MESSAGE = "Loại dòng không hợp lệ (phải là dịch vụ hoặc thiết bị)";
export const UNIT_PRICE_INVALID_MESSAGE = "Đơn giá phải là số và không được âm";
export const QUANTITY_INVALID_MESSAGE = "Số lượng phải là số nguyên từ 1 trở lên";
export const SUBSCRIBER_CODE_REQUIRED_MESSAGE = "Dòng dịch vụ phải có mã thuê bao";

export function subscriberCodeDuplicateMessage(code: string): string {
  return `Mã thuê bao "${code}" bị trùng trong đơn hàng`;
}

/**
 * Chuẩn hóa + validate mảng dòng từ client. Hàm thuần, không gọi DB.
 * - `service`: bắt buộc đúng 1 `subscriberCode` (không trống, không trùng
 *   trong cùng đơn), `quantity` luôn là 1 (không cho client tự đặt khác).
 * - `device`: không có mã thuê bao (bỏ qua nếu client gửi kèm), số lượng >= 1.
 * - `amount` luôn do server tính = quantity * unitPrice.
 */
export function normalizeContractItems(rawItems: ContractItemInput[]): NormalizedContractItem[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error(ITEMS_REQUIRED_MESSAGE);
  }

  const seenCodes = new Set<string>();
  return rawItems.map((raw, idx) => {
    const lineType = raw?.lineType;
    if (lineType !== "service" && lineType !== "device") {
      throw new Error(LINE_TYPE_INVALID_MESSAGE);
    }

    const unitPrice = Number(raw.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(UNIT_PRICE_INVALID_MESSAGE);
    }

    let quantity: number;
    let subscriberCode: string | null;

    if (lineType === "service") {
      quantity = 1;
      subscriberCode = raw.subscriberCode ? String(raw.subscriberCode).trim() : "";
      if (!subscriberCode) {
        throw new Error(SUBSCRIBER_CODE_REQUIRED_MESSAGE);
      }
      const key = subscriberCode.toLowerCase();
      if (seenCodes.has(key)) {
        throw new Error(subscriberCodeDuplicateMessage(subscriberCode));
      }
      seenCodes.add(key);
    } else {
      subscriberCode = null;
      const rawQuantity = raw.quantity === undefined || raw.quantity === null ? 1 : Number(raw.quantity);
      if (!Number.isInteger(rawQuantity) || rawQuantity < 1) {
        throw new Error(QUANTITY_INVALID_MESSAGE);
      }
      quantity = rawQuantity;
    }

    const termMonths =
      raw.termMonths === undefined || raw.termMonths === null || raw.termMonths === ("" as unknown)
        ? null
        : Number(raw.termMonths);

    return {
      lineNo: idx + 1,
      lineType,
      serviceGroup: raw.serviceGroup ? String(raw.serviceGroup) : null,
      serviceName: raw.serviceName ? String(raw.serviceName).trim() : null,
      packageName: raw.packageName ? String(raw.packageName).trim() : null,
      subscriberCode,
      quantity,
      unitPrice,
      amount: Math.round(quantity * unitPrice * 100) / 100,
      termMonths: Number.isInteger(termMonths) ? termMonths : null,
      startDate: raw.startDate ? String(raw.startDate) : null,
      note: raw.note ? String(raw.note) : null,
    };
  });
}

export function sumAmount(items: NormalizedContractItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export interface LegacySummary {
  subscriberCodes: string[];
  serviceName: string | null;
  packageName: string | null;
  serviceGroup: string | null;
}

/** Suy ra các cột tóm tắt cũ trên `contracts` từ danh sách dòng mới. */
export function deriveLegacySummary(items: NormalizedContractItem[]): LegacySummary {
  const serviceItems = items.filter((i) => i.lineType === "service");
  const subscriberCodes = serviceItems
    .map((i) => i.subscriberCode)
    .filter((c): c is string => Boolean(c));
  const uniq = (values: (string | null)[]) =>
    Array.from(new Set(values.filter((v): v is string => Boolean(v))));
  const names = uniq(serviceItems.map((i) => i.serviceName));
  const packages = uniq(serviceItems.map((i) => i.packageName));
  const groups = uniq(serviceItems.map((i) => i.serviceGroup));

  return {
    subscriberCodes,
    serviceName: names.length ? names.join("; ") : null,
    packageName: packages.length ? packages.join("; ") : null,
    serviceGroup: groups[0] ?? null,
  };
}

/**
 * Mở rộng payload cũ (1 dịch vụ chung + danh sách mã thuê bao) thành các dòng
 * `service` mới — để `POST/PUT /contracts` kiểu cũ (và dữ liệu nhập Excel cũ)
 * vẫn chạy được, luôn đi qua cùng một đường ghi `contract_items`.
 * Chia đều `totalValue` cho các mã, phần dư cộng vào dòng đầu.
 */
export function expandLegacyItems(input: {
  subscriberCodes: string[];
  totalValue: number;
  serviceGroup?: string | null;
  serviceName?: string | null;
  packageName?: string | null;
  termMonths?: number | null;
}): NormalizedContractItem[] {
  const codes = Array.from(
    new Set((input.subscriberCodes || []).map((c) => String(c ?? "").trim()).filter(Boolean))
  );
  if (!codes.length) {
    throw new Error(ITEMS_REQUIRED_MESSAGE);
  }
  const total = Math.round(Number(input.totalValue) || 0);
  const n = codes.length;
  const base = Math.floor(total / n);
  const remainder = total - base * n;

  return codes.map((code, idx) => {
    const unitPrice = base + (idx === 0 ? remainder : 0);
    return {
      lineNo: idx + 1,
      lineType: "service" as const,
      serviceGroup: input.serviceGroup ?? null,
      serviceName: input.serviceName ?? null,
      packageName: input.packageName ?? null,
      subscriberCode: code,
      quantity: 1,
      unitPrice,
      amount: unitPrice,
      termMonths: input.termMonths ?? null,
      startDate: null,
      note: null,
    };
  });
}

function newItemId(contractId: string, lineNo: number): string {
  return `CI-${contractId}-${lineNo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Hình dạng tối thiểu của client DB (dùng `run`/`query` top-level hoặc `tx` trong transaction). */
export interface ContractItemsDbClient {
  run: (sql: string, params?: any[]) => Promise<any>;
  query: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
}

/**
 * Thay toàn bộ dòng của một đơn hàng (xóa cũ, ghi mới) — luôn gọi trong create/updateInfo.
 * Truyền `options.db` (vd `tx` của `transaction()`) khi cần ghi trong cùng transaction —
 * ví dụ nhập Excel hợp đồng (`contract-import/commit.ts`) chạy trong một transaction chung,
 * nếu dùng `run`/`query` top-level (kết nối pool khác) sẽ không thấy được dòng `contracts`
 * vừa insert còn chưa commit.
 */
export async function replaceContractItems(
  contractId: string,
  items: NormalizedContractItem[],
  options: { legacy?: boolean; db?: ContractItemsDbClient } = {}
): Promise<void> {
  const db = options.db ?? { run, query };
  await db.run("DELETE FROM contract_items WHERE contract_id = ?", [contractId]);
  const nowIso = new Date().toISOString();
  const legacy = options.legacy ?? false;
  for (const item of items) {
    await db.run(
      `INSERT INTO contract_items (
        id, contract_id, line_no, line_type, service_group, service_name, package_name,
        subscriber_code, quantity, unit_price, amount, term_months, start_date, note, legacy, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newItemId(contractId, item.lineNo),
        contractId,
        item.lineNo,
        item.lineType,
        item.serviceGroup,
        item.serviceName,
        item.packageName,
        item.subscriberCode,
        item.quantity,
        item.unitPrice,
        item.amount,
        item.termMonths,
        item.startDate,
        item.note,
        legacy,
        nowIso,
      ]
    );
  }
}

function toItemDto(row: ContractItemRow): ContractItemDto {
  return {
    id: row.id,
    lineNo: row.line_no,
    lineType: row.line_type,
    serviceGroup: row.service_group ?? null,
    serviceName: row.service_name ?? null,
    packageName: row.package_name ?? null,
    subscriberCode: row.subscriber_code ?? null,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    amount: Number(row.amount),
    termMonths: row.term_months ?? null,
    startDate: row.start_date ?? null,
    note: row.note ?? null,
    legacy: Boolean((row as any).legacy),
  };
}

export async function listContractItems(contractId: string): Promise<ContractItemDto[]> {
  const rows = await query<ContractItemRow>(
    "SELECT * FROM contract_items WHERE contract_id = ? ORDER BY line_no ASC",
    [contractId]
  );
  return rows.map(toItemDto);
}

export async function listContractItemsForContracts(
  contractIds: string[]
): Promise<Map<string, ContractItemDto[]>> {
  const result = new Map<string, ContractItemDto[]>();
  if (!contractIds.length) return result;
  const placeholders = contractIds.map(() => "?").join(",");
  const rows = await query<ContractItemRow>(
    `SELECT * FROM contract_items WHERE contract_id IN (${placeholders}) ORDER BY contract_id, line_no ASC`,
    contractIds
  );
  for (const row of rows) {
    const list = result.get(row.contract_id) ?? [];
    list.push(toItemDto(row));
    result.set(row.contract_id, list);
  }
  return result;
}
