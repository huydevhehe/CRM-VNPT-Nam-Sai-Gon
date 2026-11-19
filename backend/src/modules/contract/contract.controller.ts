import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireAdmin } from "../../middleware/require-role.js";
import { resolveActorName, resolveStaffScope } from "../../middleware/actor.js";
import {
  ContractService,
  ContractForbiddenError,
  ContractNotFoundError,
  ContractDeleteBlockedError,
} from "./contract.service.js";
import { CONTRACT_TEMPLATES } from "./contract-templates.js";
import {
  ContractTemplateExportService,
  ContractTemplateExportError,
} from "./contract-template-export.service.js";
import {
  PaymentRequestService,
  PaymentRequestBlockedError,
  PaymentRequestConflictError,
  PaymentRequestInputError,
  PaymentRequestNotFoundError,
  type PaymentRequestData,
} from "./payment-request.service.js";
import {
  convertDocxToPdf,
  isPdfConversionAvailable,
  PdfConverterUnavailableError,
  PDF_UNAVAILABLE_MESSAGE,
} from "./docx-to-pdf.js";
import { ContractImportService, ContractImportServiceError } from "./contract-import/contract-import.service.js";

function contractErrorStatus(error: unknown, notFound = "Không tìm thấy Hợp đồng"): number {
  if (error instanceof ContractForbiddenError) return 403;
  if (error instanceof ContractNotFoundError) return 404;
  if (error instanceof ContractDeleteBlockedError) return 409;
  return error instanceof Error && error.message === notFound ? 404 : 400;
}

export const contractRouter = Router();
const contractService = new ContractService();
const paymentRequestService = new PaymentRequestService();
const contractImportService = new ContractImportService();
const contractTemplateExportService = new ContractTemplateExportService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

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
    next();
  });
}

function sendImportError(res: Response, error: any) {
  const status = error instanceof ContractImportServiceError ? error.status : 500;
  res.status(status).json({ success: false, message: error.message });
}

// POST /api/contracts/import/preview — đọc file + phân loại mới/cập nhật theo mã giao dịch (chỉ Admin).
// Đặt TRƯỚC "/:id" để không bị route "/:id" nuốt mất.
contractRouter.post(
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

      const result = await contractImportService.preview(req.file.buffer);
      res.json({ success: true, data: result });
    } catch (error: any) {
      sendImportError(res, error);
    }
  }
);

// POST /api/contracts/import/commit — ghi dữ liệu hợp đồng theo quyết định admin (chỉ Admin).
// Đặt TRƯỚC "/:id" để không bị route "/:id" nuốt mất.
contractRouter.post(
  "/import/commit",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const operator = (req as any).user?.name ?? (req as any).user?.id ?? "Admin";
      const { decisions } = req.body ?? {};
      const result = await contractImportService.commit({ decisions }, operator);
      res.json({ success: true, data: result });
    } catch (error: any) {
      sendImportError(res, error);
    }
  }
);

// GET /api/contracts/templates — danh sách mẫu hợp đồng (T10, STT 11), kèm mẫu nào có file/chưa có.
// Mọi user đăng nhập đều xem được (để hiển thị ở form tạo/sửa đơn).
contractRouter.get("/templates", requireAuth, (_req: Request, res: Response) => {
  res.json({ success: true, data: CONTRACT_TEMPLATES });
});

// GET /api/contracts/ctv-commission-gaps — báo cáo chỉ đọc, chỉ Admin (phải khai báo TRƯỚC /:id).
contractRouter.get("/ctv-commission-gaps", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const gaps = await contractService.getCtvCommissionGaps();
    res.json({ success: true, data: gaps });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/contracts/payment-requests (phải khai báo TRƯỚC /:id)
contractRouter.get("/payment-requests", requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await paymentRequestService.listExports(await resolveStaffScope(req));
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/contracts
contractRouter.get("/", async (req: Request, res: Response) => {
  try {
    const contracts = await contractService.getAll(await resolveStaffScope(req));
    res.json({ success: true, data: contracts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/contracts
contractRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      transactionCode,
      subscriberCodes,
      totalValue,
      channel,
      leadId,
      territoryId,
      amStaff,
      serviceGroup,
      serviceName,
      packageName,
      paymentMethod,
      customerId,
      taxCode,
      contractNumber,
      signedDate,
      termMonths,
      prepaidMonths,
      channelSourceId,
      referredByCtvId,
      contractTemplate,
      items,
    } = req.body;

    const actor = {
      role: req.user?.role || "",
      name: (await resolveActorName(req)) ?? undefined,
    };

    const hasItems = Array.isArray(items) && items.length > 0;
    const contract = await contractService.create(
      {
        transactionCode,
        subscriberCodes,
        totalValue: hasItems ? undefined : Number(totalValue),
        channel,
        leadId,
        territoryId,
        amStaff,
        serviceGroup,
        serviceName,
        packageName,
        paymentMethod,
        customerId,
        taxCode,
        contractNumber,
        signedDate,
        termMonths,
        prepaidMonths,
        channelSourceId,
        referredByCtvId,
        contractTemplate,
        items,
      },
      actor
    );

    res.status(201).json({ success: true, data: contract });
  } catch (error: any) {
    res.status(contractErrorStatus(error)).json({ success: false, message: error.message });
  }
});

// PATCH /api/contracts/:id
contractRouter.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      subscriberCodes,
      totalValue,
      channel,
      leadId,
      territoryId,
      amStaff,
      serviceGroup,
      serviceName,
      packageName,
      paymentMethod,
      customerId,
      taxCode,
      contractNumber,
      signedDate,
      termMonths,
      prepaidMonths,
      channelSourceId,
      referredByCtvId,
      contractTemplate,
      items,
    } = req.body;

    const actor = {
      role: req.user?.role || "staff",
      name: (await resolveActorName(req)) ?? undefined,
    };

    const contract = await contractService.updateInfo(
      id,
      {
        subscriberCodes,
        totalValue: totalValue !== undefined ? Number(totalValue) : undefined,
        channel,
        leadId,
        territoryId,
        amStaff,
        serviceGroup,
        serviceName,
        packageName,
        paymentMethod,
        customerId,
        taxCode,
        contractNumber,
        signedDate,
        termMonths,
        prepaidMonths,
        channelSourceId,
        referredByCtvId,
        contractTemplate,
        items,
      },
      actor
    );

    res.json({ success: true, data: contract });
  } catch (error: any) {
    if (error.message === "Không có quyền chỉnh sửa đơn hàng này") {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    res.status(contractErrorStatus(error)).json({ success: false, message: error.message });
  }
});

// POST /api/contracts/:id/payments
contractRouter.post("/:id/payments", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contractService.assertCanAccess(id, await resolveStaffScope(req));
    const { amount, paidDate, note } = req.body;
    const actorName = (req as any).user?.name || (req as any).user?.username || "Admin";

    const contract = await contractService.addPayment(
      id,
      {
        amount: Number(amount),
        paidDate,
        note,
      },
      actorName
    );

    res.status(201).json({ success: true, data: contract });
  } catch (error: any) {
    res.status(contractErrorStatus(error)).json({ success: false, message: error.message });
  }
});

// GET /api/contracts/:id/payments
contractRouter.get("/:id/payments", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contractService.assertCanAccess(id, await resolveStaffScope(req));
    const payments = await contractService.listPayments(id);
    res.json({ success: true, data: payments });
  } catch (error: any) {
    const status = error instanceof ContractForbiddenError ? 403 : error.message === "Không tìm thấy Hợp đồng" ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

// DELETE /api/contracts/payments/:paymentId
contractRouter.delete("/payments/:paymentId", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const contract = await contractService.deletePayment(paymentId);
    res.json({ success: true, data: contract });
  } catch (error: any) {
    const statusCode = error.message === "Không tìm thấy lần thu tiền" ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
});

// DELETE /api/contracts/:id (T10, STT 11) — chỉ Admin. Xóa cùng transaction các
// dòng/dịch vụ/thanh toán/lịch sử đề nghị thanh toán; chặn 409 khi đã có hoa
// hồng CTV đã chi.
contractRouter.delete("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actorName = (await resolveActorName(req)) || req.user?.name || "Admin";
    const result = await contractService.deleteContract(id, actorName);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(contractErrorStatus(error)).json({ success: false, message: error.message });
  }
});

function contractTemplateExportErrorStatus(error: unknown): number {
  if (error instanceof ContractForbiddenError) return 403;
  if (error instanceof ContractTemplateExportError) return error.status;
  if (error instanceof ContractNotFoundError) return 404;
  const message = error instanceof Error ? error.message : "";
  return message === "Không tìm thấy Hợp đồng" ? 404 : 500;
}

// GET /api/contracts/:id/contract-export/preview — xem trước nội dung hợp đồng
// điền từ mẫu (T10, STT 11). Không ghi gì vào DB.
contractRouter.get("/:id/contract-export/preview", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contractService.assertCanAccess(id, await resolveStaffScope(req));
    const preview = await contractTemplateExportService.preview(id);
    res.json({ success: true, data: { ...preview, pdfAvailable: isPdfConversionAvailable() } });
  } catch (error: any) {
    res.status(contractTemplateExportErrorStatus(error)).json({ success: false, message: error.message });
  }
});

// GET /api/contracts/:id/contract-export/preview-file — xem trước bản in (PDF) ngay trong trình duyệt,
// không tải về máy (Content-Disposition: inline). Dùng chung dữ liệu render với "/file".
contractRouter.get("/:id/contract-export/preview-file", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contractService.assertCanAccess(id, await resolveStaffScope(req));
    const { docx } = await contractTemplateExportService.renderFile(id);
    const pdf = await convertDocxToPdf(docx);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="hop-dong-xem-truoc.pdf"');
    res.send(pdf);
  } catch (error: any) {
    if (error instanceof PdfConverterUnavailableError) {
      res.status(501).json({ success: false, message: PDF_UNAVAILABLE_MESSAGE });
      return;
    }
    res.status(contractTemplateExportErrorStatus(error)).json({ success: false, message: error.message });
  }
});

// GET /api/contracts/:id/contract-export/file?format=docx|pdf — tải file hợp đồng đã điền từ mẫu.
contractRouter.get("/:id/contract-export/file", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contractService.assertCanAccess(id, await resolveStaffScope(req));
    const format = parseFormat(req.query.format);
    if (!format) {
      res.status(400).json({ success: false, message: "Định dạng không hợp lệ (docx hoặc pdf)" });
      return;
    }
    const { docx, tpl } = await contractTemplateExportService.renderFile(id);
    const baseName = `Hop-dong_${tpl.key}_${id}`;
    if (format === "pdf") {
      const pdf = await convertDocxToPdf(docx);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}.pdf"`);
      res.send(pdf);
      return;
    }
    res.setHeader("Content-Type", DOCX_MIME);
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.docx"`);
    res.send(docx);
  } catch (error: any) {
    if (error instanceof PdfConverterUnavailableError) {
      res.status(501).json({ success: false, message: PDF_UNAVAILABLE_MESSAGE });
      return;
    }
    res.status(contractTemplateExportErrorStatus(error)).json({ success: false, message: error.message });
  }
});

function paymentRequestErrorStatus(error: unknown): number {
  if (error instanceof ContractForbiddenError) return 403;
  if (error instanceof PaymentRequestConflictError) return 409;
  if (error instanceof PaymentRequestInputError || error instanceof PaymentRequestBlockedError) return 400;
  if (error instanceof PaymentRequestNotFoundError) return 404;
  if (error instanceof PdfConverterUnavailableError) return 501;
  const message = error instanceof Error ? error.message : "";
  return message === "Không tìm thấy Đơn hàng" || message === "Không tìm thấy Hợp đồng" ? 404 : 500;
}

function sendPaymentRequestError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Lỗi không xác định";
  res.status(paymentRequestErrorStatus(error)).json({ success: false, message });
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Gửi file đề nghị thanh toán dạng DOCX hoặc PDF; PDF = chính file DOCX đã render đổi sang PDF. */
async function sendPaymentRequestFile(
  res: Response,
  data: PaymentRequestData,
  format: "docx" | "pdf",
  disposition: "attachment" | "inline" = "attachment"
): Promise<void> {
  const docx = paymentRequestService.render(data);
  const baseName = `De-nghi-thanh-toan_${data.MaGD}`;
  if (format === "pdf") {
    const pdf = await convertDocxToPdf(docx);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${baseName}.pdf"`);
    res.send(pdf);
    return;
  }
  res.setHeader("Content-Type", DOCX_MIME);
  res.setHeader("Content-Disposition", `${disposition}; filename="${baseName}.docx"`);
  res.send(docx);
}

function parseFormat(raw: unknown): "docx" | "pdf" | null {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "docx";
  if (value === "" || value === "docx" || value === "doc") return "docx";
  return value === "pdf" ? "pdf" : null;
}

// GET /api/contracts/:id/payment-request/preview[?docNumber=]
// Xem trước nội dung văn bản: KHÔNG cấp/tiêu số văn bản.
contractRouter.get("/:id/payment-request/preview", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contractService.assertCanAccess(id, await resolveStaffScope(req));
    const docNumber = req.query.docNumber ? String(req.query.docNumber) : undefined;
    const preview = await paymentRequestService.buildPreview(id, docNumber);
    res.json({ success: true, data: { ...preview, pdfAvailable: isPdfConversionAvailable() } });
  } catch (error: any) {
    sendPaymentRequestError(res, error);
  }
});

// GET /api/contracts/:id/payment-request/preview-file[?docNumber=] — xem trước bản in (PDF), không cấp số.
contractRouter.get("/:id/payment-request/preview-file", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contractService.assertCanAccess(id, await resolveStaffScope(req));
    const suggested = await paymentRequestService.suggestNextDocNumber(new Date().getFullYear());
    const docNumber = (req.query.docNumber ? String(req.query.docNumber).trim() : "") || suggested || "…";
    const data = await paymentRequestService.buildData(id, docNumber);
    await sendPaymentRequestFile(res, data, "pdf", "inline");
  } catch (error: any) {
    sendPaymentRequestError(res, error);
  }
});

// POST /api/contracts/:id/payment-request/confirm — XÁC NHẬN lấy số văn bản (điểm duy nhất tiêu số).
// Body: { docNumber?: string (bỏ trống = tự cấp số kế tiếp), reuseLatest?: boolean }
contractRouter.post("/:id/payment-request/confirm", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contractService.assertCanAccess(id, await resolveStaffScope(req));
    const { docNumber, reuseLatest } = req.body ?? {};
    const exportedBy = (await resolveActorName(req)) || req.user?.name || "Admin";
    const result = await paymentRequestService.confirmExport(id, {
      docNumber: docNumber === undefined || docNumber === null ? null : String(docNumber),
      exportedBy,
      reuseLatest: reuseLatest === true,
    });
    res.status(result.reused ? 200 : 201).json({
      success: true,
      data: { ...result.record, reused: result.reused },
    });
  } catch (error: any) {
    sendPaymentRequestError(res, error);
  }
});

// GET /api/contracts/:id/payment-request/file?exportId=&format=docx|pdf
// Tải file của một lần đã cấp số: DOCX và PDF cùng một số, không cấp số mới.
contractRouter.get("/:id/payment-request/file", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contractService.assertCanAccess(id, await resolveStaffScope(req));
    const format = parseFormat(req.query.format);
    if (!format) {
      res.status(400).json({ success: false, message: "Định dạng không hợp lệ (docx hoặc pdf)" });
      return;
    }
    const exportId = req.query.exportId ? String(req.query.exportId) : "";
    if (!exportId) {
      res.status(400).json({ success: false, message: "Thiếu mã lần cấp số văn bản" });
      return;
    }
    const record = await paymentRequestService.getExport(exportId, id);
    const data = await paymentRequestService.buildDataForExport(record);
    await sendPaymentRequestFile(res, data, format);
  } catch (error: any) {
    sendPaymentRequestError(res, error);
  }
});

// GET /api/contracts/:id/payment-request?docNumber=&format=docx|pdf
// Luồng một bước (giữ để tương thích): nhập số rồi tải ngay; số được cấp ở thời điểm này.
contractRouter.get("/:id/payment-request", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contractService.assertCanAccess(id, await resolveStaffScope(req));
    const docNumber = req.query.docNumber ? String(req.query.docNumber).trim() : "";
    if (!docNumber) {
      res.status(400).json({ success: false, message: "Số văn bản là bắt buộc" });
      return;
    }
    const format = parseFormat(req.query.format);
    if (!format) {
      res.status(400).json({ success: false, message: "Định dạng không hợp lệ (docx hoặc pdf)" });
      return;
    }
    if (format === "pdf" && !isPdfConversionAvailable()) {
      // Chưa cấp số khi biết chắc không xuất được PDF.
      res.status(501).json({ success: false, message: PDF_UNAVAILABLE_MESSAGE });
      return;
    }

    const exportedBy = (await resolveActorName(req)) || req.user?.name || "Admin";
    const { record } = await paymentRequestService.confirmExport(id, { docNumber, exportedBy });
    const data = await paymentRequestService.buildDataForExport(record);
    await sendPaymentRequestFile(res, data, format);
  } catch (error: any) {
    sendPaymentRequestError(res, error);
  }
});

// PATCH /api/contracts/:id/status
contractRouter.patch("/:id/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contractService.assertCanAccess(id, await resolveStaffScope(req));
    const { deploymentStatus, paymentStatus, documentStatus, totalValue } = req.body;

    const contract = await contractService.updateStatus(id, {
      deploymentStatus,
      paymentStatus,
      documentStatus,
      totalValue: totalValue !== undefined ? Number(totalValue) : undefined,
    });

    res.json({ success: true, data: contract });
  } catch (error: any) {
    res.status(contractErrorStatus(error)).json({ success: false, message: error.message });
  }
});
