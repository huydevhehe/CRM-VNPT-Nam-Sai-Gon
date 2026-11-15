import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireAdmin } from "../../middleware/require-role.js";
import { resolveActorName, resolveStaffScope } from "../../middleware/actor.js";
import { ContractService, ContractForbiddenError } from "./contract.service.js";
import { PaymentRequestService, PaymentRequestBlockedError } from "./payment-request.service.js";
import { ContractImportService, ContractImportServiceError } from "./contract-import/contract-import.service.js";

function contractErrorStatus(error: unknown, notFound = "Không tìm thấy Hợp đồng"): number {
  if (error instanceof ContractForbiddenError) return 403;
  return error instanceof Error && error.message === notFound ? 404 : 400;
}

export const contractRouter = Router();
const contractService = new ContractService();
const paymentRequestService = new PaymentRequestService();
const contractImportService = new ContractImportService();

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
    } = req.body;

    const actor = {
      role: req.user?.role || "",
      name: (await resolveActorName(req)) ?? undefined,
    };

    const contract = await contractService.create(
      {
        transactionCode,
        subscriberCodes,
        totalValue: Number(totalValue),
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

// GET /api/contracts/:id/payment-request/preview
contractRouter.patch("/:id/payment-request/preview", requireAuth, async (req: Request, res: Response) => {
  // Handled by GET below
});

contractRouter.get("/:id/payment-request/preview", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contractService.assertCanAccess(id, await resolveStaffScope(req));
    const currentYear = new Date().getFullYear();
    const suggestedDocNumber = await paymentRequestService.suggestNextDocNumber(currentYear);
    const data = await paymentRequestService.buildData(id, suggestedDocNumber || "1");

    res.json({
      success: true,
      data: {
        suggestedDocNumber,
        missingFields: data.missingFields,
      },
    });
  } catch (error: any) {
    const statusCode = contractErrorStatus(error, "Không tìm thấy Đơn hàng");
    res.status(statusCode).json({ success: false, message: error.message });
  }
});

// GET /api/contracts/:id/payment-request
contractRouter.get("/:id/payment-request", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contractService.assertCanAccess(id, await resolveStaffScope(req));
    const docNumber = req.query.docNumber ? String(req.query.docNumber).trim() : "";
    if (!docNumber) {
      res.status(400).json({ success: false, message: "Số văn bản là bắt buộc" });
      return;
    }

    const data = await paymentRequestService.buildData(id, docNumber);
    const buffer = paymentRequestService.render(data);

    const actorName = (req as any).user?.name || (req as any).user?.username || "Admin";
    await paymentRequestService.recordExport(id, docNumber, actorName);

    const filename = `De-nghi-thanh-toan_${data.MaGD}.docx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    const statusCode =
      error instanceof ContractForbiddenError
        ? 403
        : error.message === "Không tìm thấy Đơn hàng" || error.message === "Không tìm thấy Hợp đồng"
          ? 404
          : error instanceof PaymentRequestBlockedError
            ? 400
            : 500;
    res.status(statusCode).json({ success: false, message: error.message });
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
