import { Router, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { requireAuth } from "../../middleware/require-auth.js";
import { SettingsService } from "./settings.service.js";
import { sendTestMail } from "../notification/email.service.js";
import { fixMulterFileEncoding } from "../../utils/fix-upload-filename.js";

export const settingsRouter = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEMPLATE_FILES: Record<string, string> = {
  "payment-request": "de-nghi-thanh-toan.docx",
  quote: "bao-gia.docx",
};

const templateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// GET /api/settings/templates — tên file mẫu .docx hiện có của từng loại văn bản.
settingsRouter.get("/templates", requireAuth, async (_req: Request, res: Response) => {
  const data = Object.entries(TEMPLATE_FILES).map(([key, fileName]) => {
    const filePath = path.resolve(process.cwd(), "templates", fileName);
    const exists = fs.existsSync(filePath);
    return {
      key,
      fileName,
      exists,
      updatedAt: exists ? fs.statSync(filePath).mtime.toISOString() : null,
    };
  });
  res.json({ success: true, data });
});

// POST /api/settings/templates/:key — thay file mẫu .docx (field "file").
// Chỉ thay nguyên file, không chỉnh nội dung/placeholder trong trình duyệt.
settingsRouter.post(
  "/templates/:key",
  requireAuth,
  (req: Request, res: Response, next) => {
    templateUpload.single("file")(req, res, (err: unknown) => {
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
  },
  async (req: Request, res: Response) => {
    try {
      const fileName = TEMPLATE_FILES[req.params.key];
      if (!fileName) {
        res.status(400).json({ success: false, message: "Loại biểu mẫu không hợp lệ" });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, message: "Thiếu file mẫu .docx" });
        return;
      }
      if (!file.originalname.toLowerCase().endsWith(".docx")) {
        res.status(400).json({ success: false, message: "Chỉ chấp nhận file .docx" });
        return;
      }
      const filePath = path.resolve(process.cwd(), "templates", fileName);
      fs.writeFileSync(filePath, file.buffer);
      res.json({ success: true, data: { key: req.params.key, fileName, updatedAt: new Date().toISOString() } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Toàn bộ /api/settings chỉ dành cho Admin (server.ts gắn requireAdmin).

// GET /api/settings — cấu hình SMTP/Zalo hiện tại
settingsRouter.get("/", requireAuth, async (_req: Request, res: Response) => {
  try {
    const view = await SettingsService.getView();
    res.json({ success: true, data: view });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/settings — cập nhật cấu hình SMTP/Zalo
settingsRouter.put("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      smtpMode,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFromName,
      smtpFromEmail,
      zaloOaId,
      zaloOaToken,
      paymentBeneficiary,
      paymentAccountNo,
      paymentBankName,
      paymentSignerName,
    } = req.body;
    const view = await SettingsService.update({
      smtpMode,
      smtpHost,
      smtpPort: smtpPort !== undefined && smtpPort !== "" ? Number(smtpPort) : undefined,
      smtpUser,
      smtpPass,
      smtpFromName,
      smtpFromEmail,
      zaloOaId,
      zaloOaToken,
      paymentBeneficiary,
      paymentAccountNo,
      paymentBankName,
      paymentSignerName,
    });
    res.json({ success: true, data: view });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// POST /api/settings/smtp/test — gửi thử tới một email bất kỳ.
// Có `override` thì dùng cấu hình đang nhập trên form (chưa Lưu); không có
// host (đã lưu hoặc override) → 400 rõ ràng, không rơi về Ethereal.
settingsRouter.post("/smtp/test", requireAuth, async (req: Request, res: Response) => {
  try {
    const { to, override } = req.body ?? {};
    if (typeof to !== "string" || !EMAIL_PATTERN.test(to.trim())) {
      res.status(400).json({ success: false, message: "Địa chỉ email \"Gửi thử tới\" không hợp lệ" });
      return;
    }

    const normalizedOverride = override
      ? {
          smtpMode: override.smtpMode,
          smtpHost: override.smtpHost,
          smtpPort:
            override.smtpPort !== undefined && override.smtpPort !== ""
              ? Number(override.smtpPort)
              : undefined,
          smtpUser: override.smtpUser,
          smtpPass: override.smtpPass,
          smtpFromName: override.smtpFromName,
          smtpFromEmail: override.smtpFromEmail,
        }
      : undefined;

    const result = await sendTestMail(to.trim(), normalizedOverride);
    if (!result.sent) {
      res.status(400).json({ success: false, message: result.error || "Gửi thử thất bại", data: result });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});
