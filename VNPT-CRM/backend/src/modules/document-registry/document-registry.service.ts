import { query } from "../../database/db.js";

export type DocumentRegistryType = "bao-gia" | "de-nghi-thanh-toan" | "to-trinh";

export interface DocumentRegistryEntry {
  type: DocumentRegistryType;
  /** Số hiển thị đầy đủ, ví dụ "12/BG-VNPT.TPHCM-NSG". */
  displayNumber: string;
  docNumber: string;
  issuedAt: string;
  issuedBy: string | null;
  /** Tên khách hàng (Báo giá/ĐNTT) hoặc ghi chú (Tờ trình). */
  note: string | null;
}

const SUFFIX_BY_TYPE: Record<DocumentRegistryType, string> = {
  "bao-gia": "BG-VNPT.TPHCM-NSG",
  "de-nghi-thanh-toan": "DNTT-VNPT.TPHCM-NSG",
  "to-trinh": "TTr-VNPT.TPHCM-NSG",
};

export class DocumentRegistryService {
  /** Gộp cả 3 loại văn bản, lọc theo năm nếu có (yyyy, theo ngày cấp). */
  async list(year?: string): Promise<DocumentRegistryEntry[]> {
    const yearPrefix = year ? `${year}%` : null;

    const quoteRows = await query<{
      doc_number: string;
      exported_at: string;
      exported_by: string | null;
      customer_name: string | null;
    }>(
      `SELECT q.doc_number, q.exported_at, q.exported_by, c.name as customer_name
       FROM quote_exports q LEFT JOIN customers c ON c.id = q.customer_id
       ${yearPrefix ? "WHERE q.exported_at LIKE ?" : ""}`,
      yearPrefix ? [yearPrefix] : []
    );

    const paymentRows = await query<{
      doc_number: string;
      exported_at: string;
      exported_by: string | null;
      customer_name: string | null;
    }>(
      `SELECT e.doc_number, e.exported_at, e.exported_by, c.customer_name
       FROM payment_request_exports e LEFT JOIN contracts c ON c.id = e.contract_id
       ${yearPrefix ? "WHERE e.exported_at LIKE ?" : ""}`,
      yearPrefix ? [yearPrefix] : []
    );

    const memoRows = await query<{
      doc_number: string;
      registered_at: string;
      registered_by: string | null;
      note: string | null;
    }>(
      `SELECT doc_number, registered_at, registered_by, note FROM memo_registry
       ${year ? "WHERE year = ?" : ""}`,
      year ? [year] : []
    );

    const entries: DocumentRegistryEntry[] = [
      ...quoteRows.map((r) => ({
        type: "bao-gia" as const,
        displayNumber: `${r.doc_number}/${SUFFIX_BY_TYPE["bao-gia"]}`,
        docNumber: r.doc_number,
        issuedAt: r.exported_at,
        issuedBy: r.exported_by,
        note: r.customer_name,
      })),
      ...paymentRows.map((r) => ({
        type: "de-nghi-thanh-toan" as const,
        displayNumber: `${r.doc_number}/${SUFFIX_BY_TYPE["de-nghi-thanh-toan"]}`,
        docNumber: r.doc_number,
        issuedAt: r.exported_at,
        issuedBy: r.exported_by,
        note: r.customer_name,
      })),
      ...memoRows.map((r) => ({
        type: "to-trinh" as const,
        displayNumber: `${r.doc_number}/${SUFFIX_BY_TYPE["to-trinh"]}`,
        docNumber: r.doc_number,
        issuedAt: r.registered_at,
        issuedBy: r.registered_by,
        note: r.note,
      })),
    ];

    return entries.sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
  }
}
