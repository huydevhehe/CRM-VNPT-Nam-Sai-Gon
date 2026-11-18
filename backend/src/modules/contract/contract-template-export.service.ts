import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { query } from "../../database/db.js";
import { ContractRow } from "./contract.service.js";
import { listContractItems } from "./contract-items.js";
import { findContractTemplate, ContractTemplateDef } from "./contract-templates.js";
import { numberToVietnameseWords } from "../../utils/vn-number-words.js";
import { extractDocxLines } from "./payment-request.service.js";
import { mergeDocxWithAltChunkAppendices } from "./docx-altchunk-merge.js";

/**
 * 2 mẫu Chữ ký số (CKS) có phụ lục đi kèm (phiếu đề nghị VNPT-CA, điều khoản
 * sử dụng dịch vụ...). Sau khi render hợp đồng chính, các phụ lục tương ứng
 * được render (qua docxtemplater, cùng `data`) rồi gộp vào cuối bằng kỹ thuật
 * `altChunk` (xem docx-altchunk-merge.ts) để ra 1 file docx duy nhất.
 * File nằm trong backend/templates/contracts/appendix/.
 */
const TEMPLATE_APPENDICES: Record<string, readonly string[]> = {
  cks_token_smartca_dn: ["cks-token-phu-luc-dang-ky.docx", "cks-dieu-khoan-chung.docx"],
  cks_smartca_cn_dn: [
    "cks-cn-thuoc-dn-phu-luc-to-chuc.docx",
    "cks-cn-thuoc-dn-phu-luc-ca-nhan.docx",
    "cks-cn-thuoc-dn-phu-luc-bao-ve-du-lieu.docx",
    "cks-dieu-khoan-chung.docx",
  ],
};

/** Dấu "……" đánh dấu rõ các trường KHÔNG có dữ liệu trong CRM (người đại diện,
 * CCCD, ngày/nơi cấp...) — không tự bịa nội dung, để trống có đánh dấu. */
const BLANK_MARK = "……………";

export class ContractTemplateExportError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface ContractTemplateExportPreview {
  templateKey: string;
  templateLabel: string;
  missingFields: string[];
  lines: string[];
}

interface ItemRow {
  TT: string;
  HangMuc: string;
  DonVi: string;
  SoLuong: string;
  DonGia: string;
  ThanhTien: string;
}

function money(n: number): string {
  return Math.round(n).toLocaleString("vi-VN");
}

export class ContractTemplateExportService {
  private templateDir = path.resolve(process.cwd(), "templates/contracts");

  private resolveTemplate(templateKey: string | null | undefined): ContractTemplateDef {
    const tpl = findContractTemplate(templateKey || undefined);
    if (!tpl) {
      throw new ContractTemplateExportError(
        "Đơn hàng chưa có mẫu hợp đồng hợp lệ. Vui lòng chọn mẫu hợp đồng trước khi xuất.",
        400
      );
    }
    if (!tpl.available || !tpl.file) {
      throw new ContractTemplateExportError(
        `Mẫu "${tpl.label}" chưa có file mẫu trong hệ thống. Vui lòng gửi file mẫu để bổ sung.`,
        501
      );
    }
    return tpl;
  }

  private async buildData(contractId: string): Promise<{
    tpl: ContractTemplateDef;
    data: Record<string, string | ItemRow[]>;
    missingFields: string[];
  }> {
    const rows = await query<ContractRow>("SELECT * FROM contracts WHERE id = ?", [contractId]);
    if (!rows.length) {
      throw new ContractTemplateExportError("Không tìm thấy Đơn hàng", 404);
    }
    const contract = rows[0];
    const tpl = this.resolveTemplate(contract.contract_template);

    if (!contract.customer_id) {
      throw new ContractTemplateExportError(
        "Đơn hàng chưa gắn khách hàng. Vui lòng cập nhật khách hàng cho đơn trước khi xuất hợp đồng",
        400
      );
    }
    const custRows = await query<{ name: string; identity_code: string | null; address: string | null }>(
      "SELECT name, identity_code, address FROM customers WHERE id = ?",
      [contract.customer_id]
    );
    if (!custRows.length) {
      throw new ContractTemplateExportError("Không tìm thấy Khách hàng của đơn", 400);
    }
    const customer = custRows[0];

    const missingFields: string[] = [];
    const taxCode = contract.tax_code || customer.identity_code || "";
    if (!taxCode) missingFields.push("Mã số thuế");
    const customerName = contract.customer_name || customer.name;
    const address = customer.address || "";
    if (!address) missingFields.push("Địa chỉ khách hàng");

    // Các trường pháp lý của người đại diện khách hàng (người đại diện, chức vụ,
    // CCCD, ngày/nơi cấp) KHÔNG có trong CRM hiện tại -> để trống có đánh dấu,
    // KHÔNG tự bịa. Ghi rõ trong missingFields để FE/báo cáo nêu cho user.
    for (const label of ["Người đại diện", "Chức vụ người đại diện", "Số CCCD/Hộ chiếu người đại diện", "Ngày cấp CCCD", "Nơi cấp CCCD"]) {
      missingFields.push(label);
    }

    const now = new Date();
    const signed = contract.signed_date ? new Date(contract.signed_date) : now;
    const ngay = String(signed.getDate()).padStart(2, "0");
    const thang = String(signed.getMonth() + 1).padStart(2, "0");
    const nam = String(signed.getFullYear());

    const soHopDong = contract.contract_number || `HD-${contract.transaction_code}`;

    const items = await listContractItems(contractId);
    const subtotal = items.reduce((s, i) => s + i.amount, 0) || Number(contract.total_value || 0);
    const vat = Math.round(subtotal * 0.08);
    const total = subtotal + vat;

    const itemRows: ItemRow[] =
      items.length > 0
        ? items.map((item, idx) => ({
            TT: String(idx + 1),
            HangMuc: [item.serviceName, item.packageName].filter(Boolean).join(" - ") || "Dịch vụ",
            DonVi: item.lineType === "device" ? "Cái" : "Gói",
            SoLuong: String(item.quantity),
            DonGia: money(item.unitPrice),
            ThanhTien: money(item.amount),
          }))
        : [
            {
              TT: "1",
              HangMuc: contract.service_name || contract.package_name || "Dịch vụ",
              DonVi: "Gói",
              SoLuong: "1",
              DonGia: money(subtotal),
              ThanhTien: money(subtotal),
            },
          ];

    const data: Record<string, string | ItemRow[]> = {
      Ngay: ngay,
      Thang: thang,
      Nam: nam,
      SoHopDong: soHopDong,
      TenKhachHang: customerName,
      MaSoThue: taxCode,
      DiaChi: address,
      NguoiDaiDien: BLANK_MARK,
      ChucVu: BLANK_MARK,
      CCCD: BLANK_MARK,
      NgayCapCCCD: BLANK_MARK,
      NoiCapCCCD: BLANK_MARK,
      items: itemRows,
      TongTruocVAT: money(subtotal),
      ThueVAT: money(vat),
      GiaTriHopDong: money(total),
      BangChu: numberToVietnameseWords(total),
    };

    return { tpl, data, missingFields };
  }

  private renderDocxFile(filePath: string, data: Record<string, unknown>): Buffer {
    if (!fs.existsSync(filePath)) {
      throw new ContractTemplateExportError(`Không tìm thấy file mẫu: ${filePath}`, 501);
    }
    const content = fs.readFileSync(filePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => BLANK_MARK,
    });
    doc.render(data);
    return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  }

  private render(tpl: ContractTemplateDef, data: Record<string, unknown>): Buffer {
    return this.renderDocxFile(path.join(this.templateDir, tpl.file as string), data);
  }

  /** Render hợp đồng chính và gộp thêm các phụ lục (nếu mẫu có khai báo trong
   * TEMPLATE_APPENDICES) thành 1 file docx duy nhất bằng altChunk. */
  private renderWithAppendices(tpl: ContractTemplateDef, data: Record<string, unknown>): Buffer {
    const mainDocx = this.render(tpl, data);
    const appendixFiles = TEMPLATE_APPENDICES[tpl.key];
    if (!appendixFiles?.length) {
      return mainDocx;
    }
    const appendixDocxs = appendixFiles.map((fileName) =>
      this.renderDocxFile(path.join(this.templateDir, "appendix", fileName), data)
    );
    return mergeDocxWithAltChunkAppendices(mainDocx, appendixDocxs);
  }

  async preview(contractId: string): Promise<ContractTemplateExportPreview> {
    const { tpl, data, missingFields } = await this.buildData(contractId);
    const docx = this.render(tpl, data);
    const lines = extractDocxLines(docx);
    return { templateKey: tpl.key, templateLabel: tpl.label, missingFields, lines };
  }

  async renderFile(contractId: string): Promise<{ docx: Buffer; tpl: ContractTemplateDef }> {
    const { tpl, data } = await this.buildData(contractId);
    const docx = this.renderWithAppendices(tpl, data);
    return { docx, tpl };
  }
}
