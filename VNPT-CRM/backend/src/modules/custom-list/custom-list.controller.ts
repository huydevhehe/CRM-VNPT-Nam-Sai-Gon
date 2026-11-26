import { Router, Request, Response } from "express";
import { CustomListService, CustomListError } from "./custom-list.service.js";

export const customListRouter = Router();
const service = new CustomListService();

// Toàn bộ /api/custom-lists chỉ dành cho Admin (server.ts gắn requireAdmin).

function sendError(res: Response, error: any) {
  const status = error instanceof CustomListError ? error.status : 500;
  res.status(status).json({ success: false, message: error.message });
}

// GET /api/custom-lists — toàn bộ danh mục tùy biến kèm giá trị bên trong.
customListRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const data = await service.listAll();
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

// POST /api/custom-lists — tạo danh mục mới. Body: { name }
customListRouter.post("/", async (req: Request, res: Response) => {
  try {
    const data = await service.createList(req.body?.name);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

// PATCH /api/custom-lists/:id — đổi tên danh mục. Body: { name }
customListRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const data = await service.renameList(req.params.id, req.body?.name);
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

// DELETE /api/custom-lists/:id — xóa cả danh mục lẫn các giá trị bên trong.
customListRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await service.removeList(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    sendError(res, error);
  }
});

// POST /api/custom-lists/:id/items — thêm giá trị vào danh mục. Body: { value }
customListRouter.post("/:id/items", async (req: Request, res: Response) => {
  try {
    const data = await service.addItem(req.params.id, req.body?.value);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

// PATCH /api/custom-lists/items/:itemId — sửa giá trị hoặc ẩn/hiện. Body: { value?, active? }
customListRouter.patch("/items/:itemId", async (req: Request, res: Response) => {
  try {
    const data = await service.updateItem(req.params.itemId, {
      value: req.body?.value,
      active: req.body?.active,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

// DELETE /api/custom-lists/items/:itemId — xóa hẳn 1 giá trị.
customListRouter.delete("/items/:itemId", async (req: Request, res: Response) => {
  try {
    await service.removeItem(req.params.itemId);
    res.json({ success: true });
  } catch (error: any) {
    sendError(res, error);
  }
});
