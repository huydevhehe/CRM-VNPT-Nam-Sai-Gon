import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireAdmin } from "../../middleware/require-role.js";
import { resolveStaffScope } from "../../middleware/actor.js";
import { ServiceService, ServiceServiceError } from "./service.service.js";
import { ServiceImportService, ServiceImportServiceError } from "./service-import/service-import.service.js";

export const serviceRouter = Router();
const serviceService = new ServiceService();
const serviceImportService = new ServiceImportService();

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

function sendError(res: Response, error: any) {
  const status = error instanceof ServiceServiceError ? error.status : 500;
  res.status(status).json({ success: false, message: error.message });
}

function sendImportError(res: Response, error: any) {
  const status = error instanceof ServiceImportServiceError ? error.status : 500;
  res.status(status).json({ success: false, message: error.message });
}

// POST /api/services/import/preview — đọc file + phân loại mới/cập nhật theo (khách + mã thuê bao) (chỉ Admin).
// Đặt TRƯỚC "/:id" để không bị route "/:id" nuốt mất.
serviceRouter.post(
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

      const result = await serviceImportService.preview(req.file.buffer);
      res.json({ success: true, data: result });
    } catch (error: any) {
      sendImportError(res, error);
    }
  }
);

// POST /api/services/import/commit — ghi dịch vụ theo quyết định admin (chỉ Admin).
serviceRouter.post("/import/commit", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const operator = (req as any).user?.name ?? (req as any).user?.id ?? "Admin";
    const { decisions } = req.body ?? {};
    const result = await serviceImportService.commit({ decisions }, operator);
    res.json({ success: true, data: result });
  } catch (error: any) {
    sendImportError(res, error);
  }
});

// GET /api/services — AM chỉ thấy dịch vụ do mình phụ trách (bỏ qua ?staff=)
serviceRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { expiringWithinDays } = req.query;
    const scope = await resolveStaffScope(req);
    const staff = scope ?? req.query.staff;
    const parsedDays =
      expiringWithinDays !== undefined ? Number(expiringWithinDays) : undefined;

    const services = await serviceService.getAll({
      staff: staff as string,
      expiringWithinDays: parsedDays,
    });
    res.json({ success: true, data: services });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/services — AM chỉ thêm dịch vụ cho khách hàng do mình phụ trách
serviceRouter.post("/", async (req: Request, res: Response) => {
  try {
    const scope = await resolveStaffScope(req);
    const service = await serviceService.create(req.body ?? {}, scope);
    res.status(201).json({ success: true, data: service });
  } catch (error: any) {
    sendError(res, error);
  }
});

// PATCH /api/services/:id — AM chỉ sửa dịch vụ do mình phụ trách
serviceRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const scope = await resolveStaffScope(req);
    const service = await serviceService.update(req.params.id, req.body ?? {}, scope);
    res.json({ success: true, data: service });
  } catch (error: any) {
    sendError(res, error);
  }
});

// DELETE /api/services/:id — chỉ Admin
serviceRouter.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await serviceService.remove(req.params.id);
    res.json({ success: true, message: "Đã xóa dịch vụ" });
  } catch (error: any) {
    sendError(res, error);
  }
});
