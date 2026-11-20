import { Router, Request, Response } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { ReportService } from "./report.service.js";

export const reportRouter = Router();
const reportService = new ReportService();

// Toàn bộ /api/reports chỉ dành cho Admin (server.ts gắn requireAdmin).

// GET /api/reports/audit-logs — Nhật ký hệ thống
reportRouter.get("/audit-logs", requireAuth, async (_req: Request, res: Response) => {
  try {
    const logs = await reportService.getAuditLogs();
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/summary — số liệu báo cáo tổng hợp
reportRouter.get("/summary", requireAuth, async (_req: Request, res: Response) => {
  try {
    const summary = await reportService.getSummary();
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
