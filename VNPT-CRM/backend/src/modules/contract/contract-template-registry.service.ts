import fs from "node:fs";
import path from "node:path";
import { query, run } from "../../database/db.js";
import { HttpError } from "../auth/auth.service.js";
import { CONTRACT_TEMPLATE_DEFS } from "./contract-templates.js";

export interface ContractTemplateInfo {
  key: string;
  label: string;
  available: boolean;
  file: string;
  supportsItemsTable?: boolean;
}

const TEMPLATE_DIR = path.resolve(process.cwd(), "templates/contracts");

export class ContractTemplateRegistryService {
  private templateDir: string;

  constructor(templateDir: string = TEMPLATE_DIR) {
    this.templateDir = templateDir;
  }

  /** Danh sách 7 mẫu hợp đồng, đã gộp tên Admin đổi (nếu có) và trạng thái có/chưa có file thật (đọc trực tiếp từ đĩa). */
  async list(): Promise<ContractTemplateInfo[]> {
    const overrides = await query<{ key: string; label: string }>(
      "SELECT key, label FROM contract_template_overrides"
    );
    const overrideMap = new Map(overrides.map((o) => [o.key, o.label]));

    return CONTRACT_TEMPLATE_DEFS.map((def) => ({
      key: def.key,
      label: overrideMap.get(def.key) ?? def.label,
      file: def.file,
      supportsItemsTable: def.supportsItemsTable,
      available: fs.existsSync(path.join(this.templateDir, def.file)),
    }));
  }

  async get(key: string): Promise<ContractTemplateInfo | undefined> {
    const all = await this.list();
    return all.find((t) => t.key === key);
  }

  /** Admin đổi tên hiển thị của 1 mẫu hợp đồng. */
  async rename(key: string, label: string): Promise<ContractTemplateInfo> {
    const def = CONTRACT_TEMPLATE_DEFS.find((d) => d.key === key);
    if (!def) {
      throw new HttpError(404, "Mẫu hợp đồng không tồn tại");
    }
    const trimmedLabel = (label || "").trim();
    if (!trimmedLabel) {
      throw new HttpError(400, "Tên mẫu không được để trống");
    }
    await run(
      `INSERT INTO contract_template_overrides (key, label, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, updated_at = EXCLUDED.updated_at`,
      [key, trimmedLabel, new Date().toISOString()]
    );
    return (await this.get(key))!;
  }

  /** Đường dẫn file thật trên đĩa của 1 mẫu (dùng để lưu file Admin upload lên). */
  getFilePath(key: string): string {
    const def = CONTRACT_TEMPLATE_DEFS.find((d) => d.key === key);
    if (!def) {
      throw new HttpError(404, "Mẫu hợp đồng không tồn tại");
    }
    return path.join(this.templateDir, def.file);
  }

  /** Lưu buffer file Admin upload đè lên đúng vị trí file mẫu của 1 key. */
  saveFile(key: string, buffer: Buffer): void {
    const filePath = this.getFilePath(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
  }
}
