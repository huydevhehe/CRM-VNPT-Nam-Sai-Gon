import { Router, Request, Response, NextFunction } from "express";
import fs from "fs";
import multer from "multer";
import * as XLSX from "xlsx";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireAdmin } from "../../middleware/require-role.js";
import { CustomerService, CustomerServiceError } from "./customer.service.js";
import { CustomerDocumentService, CustomerDocumentServiceError } from "./customer-document.service.js";
import { ServiceService } from "../service/service.service.js";
import { CustomerImportService, CustomerImportServiceError } from "./customer-import/customer-import.service.js";
import { fixMulterFileEncoding } from "../../utils/fix-upload-filename.js";
import {
  QuoteService,
  QuoteBlockedError,
  QuoteConflictError,
  QuoteInputError,
  QuoteNotFoundError,
  type QuoteData,
} from "./quote.service.js";
import {
  convertDocxToPdf,
  isPdfConversionAvailable,
  PdfConverterUnavailableError,
  PDF_UNAVAILABLE_MESSAGE,
} from "../contract/docx-to-pdf.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function handleDocUpload(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? "File vượt quá 10 MB"
          : err instanceof Error
            ? err.message
            : "Lỗi upload file";
      res.status(400).json({ success: false, message });
      return;
    }
    fixMulterFileEncoding(req.file);
    next();
  });
}

export const customerRouter = Router();
const customerService = new CustomerService();
const customerDocumentService = new CustomerDocumentService();
const serviceService = new ServiceService();
const customerImportService = new CustomerImportService();
const quoteService = new QuoteService();

function sendError(res: Response, error: any) {
  const status = error instanceof CustomerServiceError ? error.status : 500;
  res.status(status).json({ success: false, message: error.message });
}

function sendImportError(res: Response, error: any) {
  const status = error instanceof CustomerImportServiceError ? error.status : 500;
  res.status(status).json({ success: false, message: error.message });
}

function handleImportUpload(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? "File vượt quá 10 MB"
          : err instanceof Error
            ? err.message
            : "Lỗi upload file";
      res.status(400).json({ success: false, message });
      return;
    }
    fixMulterFileEncoding(req.file);
    next();
  });
}

function sendDocError(res: Response, error: any) {
  const status = error instanceof CustomerDocumentServiceError ? error.status : 500;
  res.status(status).json({ success: false, message: error.message });
}

customerRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { search, group } = req.query;
    const customers = await customerService.getAll(
      typeof search === "string" ? search : undefined,
      typeof group === "string" ? group : undefined
    );
    res.json({ success: true, data: customers });
  } catch (error: any) {
    sendError(res, error);
  }
});

// GET /api/customers/ctv-options — danh sách CTV để chọn "CTV giới thiệu" (mọi nhân viên; /api/ctv-accounts chỉ Admin).
// Đặt TRƯỚC "/:id" để không bị route "/:id" nuốt mất.
customerRouter.get("/ctv-options", async (_req: Request, res: Response) => {
  try {
    const options = await customerService.listCtvOptions();
    res.json({ success: true, data: options });
  } catch (error: any) {
    sendError(res, error);
  }
});

customerRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const operator = { name: req.user?.name ?? req.user?.id ?? "Admin", role: req.user?.role ?? "" };
    const result = await customerService.create(req.body ?? {}, operator);
    res.status(201).json({ success: true, data: result.customer, message: result.message });
  } catch (error: any) {
    sendError(res, error);
  }
});

// PATCH /api/customers/team — gán/gỡ team cho nhiều khách cùng lúc (chỉ Admin).
// Đặt TRƯỚC "/:id" để không bị route "/:id" (id="team") nuốt mất.
customerRouter.patch("/team", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { customerIds, teamId } = req.body ?? {};
    const updated = await customerService.assignTeam(customerIds, teamId ?? null);
    res.json({ success: true, data: { updated } });
  } catch (error: any) {
    sendError(res, error);
  }
});

// POST /api/customers/import/preview — đọc file + phân loại trùng, không ghi DB (chỉ Admin).
// Đặt TRƯỚC "/:id" để không bị route "/:id" nuốt mất.
customerRouter.post(
  "/import/preview",
  requireAuth,
  requireAdmin,
  handleImportUpload,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: "Vui lòng chọn file Excel (.xlsx / .xls)" });
        return;
      }
      const originalName = req.file.originalname.toLowerCase();
      if (!originalName.endsWith(".xlsx") && !originalName.endsWith(".xls")) {
        res.status(400).json({ success: false, message: "Chỉ hỗ trợ file .xlsx hoặc .xls" });
        return;
      }

      const defaultStaff =
        typeof req.body?.defaultStaff === "string" && req.body.defaultStaff.trim()
          ? req.body.defaultStaff.trim()
          : null;

      const result = await customerImportService.preview(req.file.buffer, defaultStaff);
      res.json({ success: true, data: result });
    } catch (error: any) {
      sendImportError(res, error);
    }
  }
);

// POST /api/customers/import/commit — ghi dữ liệu theo quyết định admin (chỉ Admin).
// Đặt TRƯỚC "/:id" để không bị route "/:id" nuốt mất.
customerRouter.post("/import/commit", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const operator = req.user?.name ?? req.user?.id ?? "Admin";
    const { territoryId, handoverBatch, decisions } = req.body ?? {};
    const result = await customerImportService.commit(
      { territoryId: territoryId ?? null, handoverBatch, decisions },
      operator
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    sendImportError(res, error);
  }
});

// PATCH /api/customers/assign-staff — gán AM chăm sóc/phụ trách cho nhiều khách cùng lúc (chỉ Admin).
// Đặt TRƯỚC "/:id" để không bị route "/:id" nuốt mất.
customerRouter.patch("/assign-staff", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const operator = req.user?.name ?? req.user?.id ?? "Admin";
    const { customerIds, amCaringStaff, amStaff } = req.body ?? {};
    const result = await customerService.assignStaffBulk({ customerIds, amCaringStaff, amStaff }, operator);
    res.json({ success: true, data: result });
  } catch (error: any) {
    sendError(res, error);
  }
});

customerRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const customer = await customerService.getById(req.params.id);
    res.json({ success: true, data: customer });
  } catch (error: any) {
    sendError(res, error);
  }
});

// DELETE /api/customers/:id — chỉ Admin. 409 nếu khách còn đơn hàng liên quan.
customerRouter.delete("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const operator = req.user?.name ?? req.user?.id ?? "Admin";
    const result = await customerService.delete(req.params.id, operator);
    res.json({ success: true, message: result.message });
  } catch (error: any) {
    sendError(res, error);
  }
});

customerRouter.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const operator = { name: req.user?.name ?? req.user?.id ?? "Admin", role: req.user?.role ?? "" };
    const updated = await customerService.update(id, req.body ?? {}, operator);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
});

// GET /api/customers/:id/documents — danh sách giấy tờ đính kèm của 1 khách
// GET /api/customers/:id/services — toàn bộ dịch vụ khách đang dùng (trang chi tiết)
customerRouter.get("/:id/services", requireAuth, async (req: Request, res: Response) => {
  try {
    const services = await serviceService.listByCustomer(req.params.id);
    res.json({ success: true, data: services });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

customerRouter.get("/:id/documents", requireAuth, async (req: Request, res: Response) => {
  try {
    const docs = await customerDocumentService.list(req.params.id);
    res.json({ success: true, data: docs });
  } catch (error: any) {
    sendDocError(res, error);
  }
});

function quoteErrorStatus(error: unknown): number {
  if (error instanceof QuoteConflictError) return 409;
  if (error instanceof QuoteInputError || error instanceof QuoteBlockedError) return 400;
  if (error instanceof QuoteNotFoundError) return 404;
  if (error instanceof PdfConverterUnavailableError) return 501;
  return 500;
}

function sendQuoteError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Lỗi không xác định";
  res.status(quoteErrorStatus(error)).json({ success: false, message });
}

function parseQuoteFileFormat(raw: unknown): "docx" | "pdf" | null {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "docx";
  if (value === "" || value === "docx" || value === "doc") return "docx";
  return value === "pdf" ? "pdf" : null;
}

const QUOTE_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function sendQuoteFile(
  res: Response,
  data: QuoteData,
  format: "docx" | "pdf",
  disposition: "attachment" | "inline" = "attachment"
): Promise<void> {
  const docx = quoteService.render(data);
  const baseName = `Bao-gia_${data.soBaoGia}`;
  if (format === "pdf") {
    const pdf = await convertDocxToPdf(docx);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${baseName}.pdf"`);
    res.send(pdf);
    return;
  }
  res.setHeader("Content-Type", QUOTE_DOCX_MIME);
  res.setHeader("Content-Disposition", `${disposition}; filename="${baseName}.docx"`);
  res.send(docx);
}

function readQuoteInput(body: any) {
  return {
    serviceType: String(body?.serviceType ?? ""),
    packageName: String(body?.packageName ?? ""),
    unit: String(body?.unit ?? ""),
    quantity: Number(body?.quantity ?? 0),
    unitPrice: Number(body?.unitPrice ?? 0),
    vatPercent: body?.vatPercent === undefined || body?.vatPercent === null ? undefined : Number(body.vatPercent),
    note: body?.note ? String(body.note) : undefined,
    staffName: body?.staffName ? String(body.staffName) : undefined,
    eoNumber: body?.eoNumber ? String(body.eoNumber) : undefined,
  };
}

// GET /api/customers/:id/quote/preview?docNumber= — xem trước, KHÔNG cấp số báo giá.
// Body/query dùng chung readQuoteInput để nhập thông tin dịch vụ cần báo giá.
customerRouter.post("/:id/quote/preview", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const docNumber = req.query.docNumber ? String(req.query.docNumber) : undefined;
    const preview = await quoteService.buildPreview(id, readQuoteInput(req.body), docNumber);
    res.json({ success: true, data: { ...preview, pdfAvailable: isPdfConversionAvailable() } });
  } catch (error: any) {
    sendQuoteError(res, error);
  }
});

// POST /api/customers/:id/quote/confirm — XÁC NHẬN lấy số báo giá (điểm duy nhất tiêu số).
customerRouter.post("/:id/quote/confirm", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { docNumber, reuseLatest } = req.body ?? {};
    const exportedBy = req.user?.name ?? req.user?.id ?? "Admin";
    const result = await quoteService.confirmExport(id, {
      ...readQuoteInput(req.body),
      docNumber: docNumber === undefined || docNumber === null ? null : String(docNumber),
      exportedBy,
      reuseLatest: reuseLatest === true,
    });
    res.status(result.reused ? 200 : 201).json({
      success: true,
      data: { ...result.record, reused: result.reused },
    });
  } catch (error: any) {
    sendQuoteError(res, error);
  }
});

// GET /api/customers/:id/quote/file?exportId=&format=docx|pdf — tải file của một lần đã cấp số.
customerRouter.get("/:id/quote/file", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const format = parseQuoteFileFormat(req.query.format);
    if (!format) {
      res.status(400).json({ success: false, message: "Định dạng không hợp lệ (docx hoặc pdf)" });
      return;
    }
    const exportId = req.query.exportId ? String(req.query.exportId) : "";
    if (!exportId) {
      res.status(400).json({ success: false, message: "Thiếu mã lần cấp số báo giá" });
      return;
    }
    if (format === "pdf" && !isPdfConversionAvailable()) {
      res.status(501).json({ success: false, message: PDF_UNAVAILABLE_MESSAGE });
      return;
    }
    const record = await quoteService.getExport(exportId, id);
    const data = await quoteService.buildDataForExport(record);
    await sendQuoteFile(res, data, format);
  } catch (error: any) {
    sendQuoteError(res, error);
  }
});

// GET /api/customers/:id/quote/exports — lịch sử các lần đã cấp số báo giá của khách.
customerRouter.get("/:id/quote/exports", requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await quoteService.listExports(req.params.id);
    res.json({ success: true, data: list });
  } catch (error: any) {
    sendQuoteError(res, error);
  }
});

// POST /api/customers/:id/documents — tải lên 1 giấy tờ (field "file", body { docType })
customerRouter.post(
  "/:id/documents",
  requireAuth,
  handleDocUpload,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: "Vui lòng chọn file để tải lên" });
        return;
      }
      const uploader = req.user?.name ?? req.user?.id ?? "Admin";
      const doc = await customerDocumentService.save(
        req.params.id,
        req.body?.docType,
        {
          originalname: req.file.originalname,
          buffer: req.file.buffer,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        uploader
      );
      res.status(201).json({ success: true, data: doc });
    } catch (error: any) {
      sendDocError(res, error);
    }
  }
);

// GET /api/customers/documents/:docId/download — tải file (yêu cầu đăng nhập, mọi nhân viên)
customerRouter.get(
  "/documents/:docId/download",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = await customerDocumentService.getFile(req.params.docId);
      if (!fs.existsSync(file.path)) {
        res.status(404).json({ success: false, message: "Không tìm thấy file trên server" });
        return;
      }
      if (file.mime) {
        res.setHeader("Content-Type", file.mime);
      }
      // Tên gốc có thể có khoảng trắng/ký tự Unicode — mã hóa theo RFC 5987
      // (filename*=UTF-8''...), không bao giờ dùng tên gốc làm đường dẫn thật
      // trên đĩa (xem Review Focus #1, chỉ dùng cho header hiển thị).
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`
      );
      res.sendFile(file.path);
    } catch (error: any) {
      sendDocError(res, error);
    }
  }
);

// DELETE /api/customers/documents/:docId — chỉ Admin
customerRouter.delete(
  "/documents/:docId",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      await customerDocumentService.remove(req.params.docId);
      res.json({ success: true, message: "Đã xóa giấy tờ" });
    } catch (error: any) {
      sendDocError(res, error);
    }
  }
);

customerRouter.patch("/:id/transfer", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newStaff } = req.body ?? {};
    const operator = req.user?.name ?? req.user?.id ?? "Admin";
    const result = await customerService.transfer(id, newStaff, operator);
    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});

customerRouter.patch("/:id/transfer-caring", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newCaringStaff, handoverBatch } = req.body ?? {};
    const operator = req.user?.name ?? req.user?.id ?? "Admin";
    const result = await customerService.transferCaringStaff(id, newCaringStaff, operator, handoverBatch);
    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});

// POST /api/customers/batches — nhập / xác lập lại tập KHDN chăm theo đợt (chỉ Admin, payload JSON)
customerRouter.post("/batches", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const operator = req.user?.name ?? req.user?.id ?? "Admin";
    const result = await customerService.importBatch(req.body, operator);
    res.status(200).json({
      success: true,
      data: result,
      message: `Đã xử lý ${result.totalProcessed} khách hàng: tạo mới ${result.createdCount}, cập nhật ${result.updatedCount}, gỡ gán cũ ${result.clearedCount}`,
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// POST /api/customers/batches/upload — upload file Excel đợt KHDN chăm (chỉ Admin)
customerRouter.post(
  "/batches/upload",
  requireAuth,
  requireAdmin,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: "Vui lòng đính kèm file Excel (.xlsx / .xls)" });
        return;
      }
      fixMulterFileEncoding(req.file);
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        res.status(400).json({ success: false, message: "File Excel không có sheet nào" });
        return;
      }
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName]);
      if (!rawRows || rawRows.length === 0) {
        res.status(400).json({ success: false, message: "File Excel rỗng" });
        return;
      }

      const customers = rawRows
        .map((row) => {
          const keys = Object.keys(row);
          const findVal = (keywords: string[]) => {
            const key = keys.find((k) => {
              const norm = k.toLowerCase().trim();
              return keywords.some((kw) => norm.includes(kw));
            });
            return key ? String(row[key] ?? "").trim() : "";
          };

          const name = findVal(["tên khách", "tên kh", "tên doanh nghiệp", "khách hàng", "name"]);
          const identityCode = findVal(["mã số thuế", "mst", "cccd", "cmnd", "identity", "mã định danh"]);
          const phone = findVal(["số điện thoại", "sđt", "điện thoại", "phone", "tel"]);
          const address = findVal(["địa chỉ", "đ/c", "address"]);
          const services = findVal(["dịch vụ", "services", "gói"]);
          const type = findVal(["loại", "type"]) || "Doanh nghiệp";

          return {
            name,
            identityCode: identityCode || undefined,
            phone: phone || undefined,
            address: address || undefined,
            services: services || undefined,
            type,
          };
        })
        .filter((c) => Boolean(c.name));

      if (customers.length === 0) {
        res.status(400).json({
          success: false,
          message: "Không tìm thấy dòng khách hàng hợp lệ (cần cột Tên khách hàng)",
        });
        return;
      }

      const { territoryId, amCaringStaff, handoverBatch, mode } = req.body ?? {};
      const operator = req.user?.name ?? req.user?.id ?? "Admin";

      const result = await customerService.importBatch(
        {
          territoryId,
          amCaringStaff,
          handoverBatch,
          mode,
          customers,
        },
        operator
      );

      res.status(200).json({
        success: true,
        data: result,
        message: `Đã xử lý ${result.totalProcessed} khách hàng: tạo mới ${result.createdCount}, cập nhật ${result.updatedCount}, gỡ gán cũ ${result.clearedCount}`,
      });
    } catch (error: any) {
      sendError(res, error);
    }
  }
);
