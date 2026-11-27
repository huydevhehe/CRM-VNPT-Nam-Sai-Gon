import { Router, Request, Response } from "express";
import { DocumentRegistryService } from "./document-registry.service.js";
import { MemoRegistryService, MemoRegistryError } from "./memo-registry.service.js";

export const documentRegistryRouter = Router();

// Toàn bộ /api/document-registry chỉ dành cho Admin (server.ts gắn requireAdmin).

const registryService = new DocumentRegistryService();
const memoService = new MemoRegistryService();

function sendError(res: Response, error: any) {
  const status = error instanceof MemoRegistryError ? error.status : 500;
  res.status(status).json({ success: false, message: error.message });
}

// GET /api/document-registry?year=2026 — Sổ văn bản: gộp Báo giá + Đề nghị thanh toán + Tờ trình.
documentRegistryRouter.get("/", async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? String(req.query.year) : undefined;
    const data = await registryService.list(year);
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

// POST /api/document-registry/memos — đăng ký số Tờ trình (nhập tay). Body: { docNumber, note? }
documentRegistryRouter.post("/memos", async (req: Request, res: Response) => {
  try {
    const registeredBy = req.user?.name ?? req.user?.id ?? "Admin";
    const data = await memoService.register({
      docNumber: req.body?.docNumber,
      note: req.body?.note,
      registeredBy,
    });
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});
