import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { ReminderSettingsService } from "./reminder-settings.service.js";
import { ReminderRunner } from "./reminder-runner.js";
import { ReminderImportService } from "./reminder-import.service.js";
import {
  ReminderSignatureService,
  ReminderTemplateService,
  TemplateValidationError,
} from "./reminder-template.service.js";
import { GroupSettingsError, ReminderGroupSettingsService } from "./reminder-group-settings.service.js";
import { query } from "../../database/db.js";
import { todayVn } from "../../utils/date-vn.js";
import { fixMulterFileEncoding } from "../../utils/fix-upload-filename.js";

export const reminderRouter = Router();

const ALLOWED_EXCEL_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];
const ALLOWED_EXCEL_EXT = /\.(xlsx|xls)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const isAllowedMime = ALLOWED_EXCEL_MIMES.includes(file.mimetype);
    const isAllowedExt = ALLOWED_EXCEL_EXT.test(file.originalname);
    if (isAllowedMime || isAllowedExt) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file Excel .xlsx/.xls"));
    }
  },
});

function handleUpload(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : "Lỗi upload file";
      res.status(400).json({ success: false, message });
      return;
    }
    fixMulterFileEncoding(req.file);
    next();
  });
}

// GET /api/reminders/settings
reminderRouter.get("/settings", async (_req: Request, res: Response) => {
  try {
    const view = await ReminderSettingsService.get();
    res.json({ success: true, data: view });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/reminders/settings
reminderRouter.put("/settings", async (req: Request, res: Response) => {
  try {
    const { enabled, runTime, daysBefore, notifyStaff, notifyCustomer, extraCc } = req.body ?? {};
    const view = await ReminderSettingsService.update({
      enabled,
      runTime,
      daysBefore,
      notifyStaff,
      notifyCustomer,
      extraCc,
    });
    res.json({ success: true, data: view });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

function sendTemplateError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Lỗi không xác định";
  res.status(error instanceof TemplateValidationError ? 400 : 500).json({ success: false, message });
}

// Các route /template nhận thêm query `?group=BRCĐ|CNTT|Di động` để thao tác mẫu riêng của nhóm; bỏ trống là mẫu chung.

// GET /api/reminders/template — mẫu đang áp dụng + mẫu mặc định + danh sách biến.
reminderRouter.get("/template", async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await ReminderTemplateService.getView(req.query.group) });
  } catch (error) {
    sendTemplateError(res, error);
  }
});

// PUT /api/reminders/template — lưu mẫu (400 nếu rỗng/quá dài/biến không hợp lệ).
reminderRouter.put("/template", async (req: Request, res: Response) => {
  try {
    const { subject, body } = req.body ?? {};
    res.json({ success: true, data: await ReminderTemplateService.save({ subject, body }, req.query.group) });
  } catch (error) {
    sendTemplateError(res, error);
  }
});

// POST /api/reminders/template/preview — render với dữ liệu mẫu (mẫu đang soạn hoặc mẫu đã lưu), kèm chữ ký.
// `signature` ({enabled, html}) là bản nháp chữ ký đang soạn; bỏ trống thì dùng chữ ký đã lưu.
reminderRouter.post("/template/preview", async (req: Request, res: Response) => {
  try {
    const { subject, body, signature } = req.body ?? {};
    res.json({
      success: true,
      data: await ReminderTemplateService.preview({ subject, body, signature }, req.query.group),
    });
  } catch (error) {
    sendTemplateError(res, error);
  }
});

// POST /api/reminders/template/reset — khôi phục mẫu mặc định (mẫu nhóm: xoá mẫu riêng, theo lại mẫu chung).
reminderRouter.post("/template/reset", async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await ReminderTemplateService.reset(req.query.group) });
  } catch (error) {
    sendTemplateError(res, error);
  }
});

// POST /api/reminders/template/test — gửi thử mẫu (dữ liệu mẫu) tới 1 email qua SMTP đã lưu.
reminderRouter.post("/template/test", async (req: Request, res: Response) => {
  try {
    const { to, subject, body, signature } = req.body ?? {};
    const result = await ReminderTemplateService.sendTest(to, { subject, body, signature }, undefined, req.query.group);
    if (!result.sent) {
      res.status(400).json({ success: false, message: result.error || "Gửi thử thất bại" });
      return;
    }
    res.json({ success: true, data: { sent: true } });
  } catch (error) {
    sendTemplateError(res, error);
  }
});

// GET /api/reminders/signature — chữ ký email (bật/tắt + nội dung HTML) và chữ ký mẫu.
reminderRouter.get("/signature", async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await ReminderSignatureService.getView() });
  } catch (error) {
    sendTemplateError(res, error);
  }
});

// PUT /api/reminders/signature — lưu chữ ký {enabled?, html?}; chỉ gửi một trong hai thì giữ nguyên phần còn lại.
reminderRouter.put("/signature", async (req: Request, res: Response) => {
  try {
    const { enabled, html } = req.body ?? {};
    res.json({ success: true, data: await ReminderSignatureService.save({ enabled, html }) });
  } catch (error) {
    sendTemplateError(res, error);
  }
});

function sendGroupError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Lỗi không xác định";
  res.status(error instanceof GroupSettingsError ? 400 : 500).json({ success: false, message });
}

// GET /api/reminders/groups — cấu hình nhắc theo từng nhóm dịch vụ (riêng/chung) + các mốc ngày chung.
reminderRouter.get("/groups", async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await ReminderGroupSettingsService.list() });
  } catch (error) {
    sendGroupError(res, error);
  }
});

// PUT /api/reminders/groups/:group — đặt ngày nhắc/công tắc riêng cho nhóm (400 nếu nhóm lạ hoặc ngày không hợp lệ).
reminderRouter.put("/groups/:group", async (req: Request, res: Response) => {
  try {
    const { enabled, daysBefore } = req.body ?? {};
    res.json({ success: true, data: await ReminderGroupSettingsService.save(req.params.group, { enabled, daysBefore }) });
  } catch (error) {
    sendGroupError(res, error);
  }
});

// DELETE /api/reminders/groups/:group — "Dùng cấu hình chung": bỏ cấu hình riêng của nhóm.
reminderRouter.delete("/groups/:group", async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await ReminderGroupSettingsService.reset(req.params.group) });
  } catch (error) {
    sendGroupError(res, error);
  }
});

// POST /api/reminders/run-now — chạy ngay, bỏ qua giờ cấu hình nhưng vẫn
// không gửi trùng (khóa duy nhất trong reminder_logs).
reminderRouter.post("/run-now", async (_req: Request, res: Response) => {
  try {
    const result = await ReminderRunner.run(todayVn(), { force: true });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reminders/logs?limit=200
reminderRouter.get("/logs", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
    const rows = await query(
      "SELECT * FROM reminder_logs ORDER BY sent_at DESC LIMIT ?",
      [limit]
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/reminders/files/inspect — đọc file, trả về sheet/headers/5 dòng mẫu, KHÔNG lưu gì.
reminderRouter.post("/files/inspect", handleUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "Vui lòng đính kèm file Excel (.xlsx)" });
      return;
    }
    const result = ReminderImportService.inspectFile(req.file.buffer);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// POST /api/reminders/files/import — nhập đợt nhắc hạn mới từ file + cấu hình cột.
reminderRouter.post("/files/import", handleUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "Vui lòng đính kèm file Excel (.xlsx)" });
      return;
    }
    const { name, daysBefore, columns } = req.body ?? {};
    const parsedDaysBefore = typeof daysBefore === "string" ? JSON.parse(daysBefore) : daysBefore;
    const parsedColumns = typeof columns === "string" ? JSON.parse(columns) : columns;
    const operator = req.user?.name ?? req.user?.id ?? "Admin";

    const result = await ReminderImportService.importFile(req.file.buffer, req.file.originalname, {
      name: name || "Đợt nhắc hạn",
      daysBefore: parsedDaysBefore,
      columns: parsedColumns,
      importedBy: operator,
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/reminders/files — danh sách đợt nhắc hạn từ file.
reminderRouter.get("/files", async (_req: Request, res: Response) => {
  try {
    const batches = await ReminderImportService.listBatches();
    res.json({ success: true, data: batches });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/reminders/files/:batchId
reminderRouter.patch("/files/:batchId", async (req: Request, res: Response) => {
  try {
    const { enabled, daysBefore, name } = req.body ?? {};
    await ReminderImportService.updateBatch(req.params.batchId, { enabled, daysBefore, name });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/reminders/files/:batchId — xóa đợt + mục của đợt; log giữ nguyên.
reminderRouter.delete("/files/:batchId", async (req: Request, res: Response) => {
  try {
    await ReminderImportService.deleteBatch(req.params.batchId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});
