import { Router, Request, Response } from "express";
import { requireAdmin } from "../../middleware/require-role.js";
import { DataRetentionService } from "./data-retention.service.js";

export const dataRetentionRouter = Router();
const service = new DataRetentionService();

// GET /api/data-retention/warnings — bản ghi nợ/gia hạn sắp tự động bị xóa
// trong 30 ngày tới (ai xem được Quản lý nợ/Gia hạn cũng xem được cảnh báo
// này, không chỉ Admin).
dataRetentionRouter.get("/warnings", async (_req: Request, res: Response) => {
  try {
    const items = await service.getUpcomingDeletions();
    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/data-retention/run-now — Admin chủ động chạy dọn ngay (chủ yếu để
// kiểm tra/vận hành thủ công, job tự động vẫn chạy định kỳ riêng).
dataRetentionRouter.post("/run-now", requireAdmin, async (req: Request, res: Response) => {
  try {
    const operator = req.user?.name ?? req.user?.id ?? "Admin";
    const result = await service.runCleanup(new Date(), operator);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
