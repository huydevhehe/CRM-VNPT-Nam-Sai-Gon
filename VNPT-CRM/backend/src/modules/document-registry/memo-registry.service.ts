import { query, run } from "../../database/db.js";

/**
 * Tờ trình được soạn nội dung hoàn toàn bên ngoài CRM (Word tự làm, tự trình ký).
 * CRM chỉ đăng ký/giữ sổ cho số đã lấy để tránh trùng số trong năm — số do
 * người dùng tự nhập tay (khác với Báo giá/Đề nghị thanh toán tự sinh số).
 */
export class MemoRegistryError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 409
  ) {
    super(message);
  }
}

export interface MemoRegistryEntry {
  id: string;
  year: string;
  docNumber: string;
  note: string | null;
  registeredBy: string | null;
  registeredAt: string;
}

interface MemoRegistryRow {
  id: string;
  year: string;
  doc_number: string;
  note: string | null;
  registered_by: string | null;
  registered_at: string;
}

function toDto(row: MemoRegistryRow): MemoRegistryEntry {
  return {
    id: row.id,
    year: row.year,
    docNumber: row.doc_number,
    note: row.note,
    registeredBy: row.registered_by,
    registeredAt: row.registered_at,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

const DOC_NUMBER_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}./-]{0,19}$/u;

export class MemoRegistryService {
  async list(year?: string): Promise<MemoRegistryEntry[]> {
    const rows = await query<MemoRegistryRow>(
      `SELECT * FROM memo_registry ${year ? "WHERE year = ?" : ""} ORDER BY registered_at DESC`,
      year ? [year] : []
    );
    return rows.map(toDto);
  }

  async register(input: { docNumber: unknown; note?: unknown; registeredBy: string }): Promise<MemoRegistryEntry> {
    const docNumber = typeof input.docNumber === "string" ? input.docNumber.trim() : "";
    if (!docNumber) {
      throw new MemoRegistryError("Số tờ trình không được để trống", 400);
    }
    if (!DOC_NUMBER_PATTERN.test(docNumber)) {
      throw new MemoRegistryError(
        "Số tờ trình không hợp lệ (tối đa 20 ký tự gồm chữ, số, dấu chấm, gạch ngang hoặc gạch chéo)",
        400
      );
    }
    const note = typeof input.note === "string" && input.note.trim() ? input.note.trim() : null;
    const year = String(new Date().getFullYear());
    const id = `MEMO-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      await run(
        `INSERT INTO memo_registry (id, year, doc_number, note, registered_by, registered_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, year, docNumber, note, input.registeredBy, new Date().toISOString()]
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new MemoRegistryError(`Số ${docNumber} đã được đăng ký trong năm ${year}`, 409);
      }
      throw error;
    }
    const rows = await query<MemoRegistryRow>("SELECT * FROM memo_registry WHERE id = ?", [id]);
    return toDto(rows[0]);
  }
}
