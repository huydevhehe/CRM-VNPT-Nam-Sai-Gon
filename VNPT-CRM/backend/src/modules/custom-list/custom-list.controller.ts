import { Router, Request, Response } from "express";
import { requireAdmin } from "../../middleware/require-role.js";
import { CustomListService, CustomListError } from "./custom-list.service.js";

export const customListRouter = Router();
const service = new CustomListService();

// GET mở cho mọi nhân viên đăng nhập (server.ts gắn requireAuth). Mọi thao tác
// sửa/xóa bên dưới gắn thêm requireAdmin riêng từng route.

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
customListRouter.post("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = await service.createList(req.body?.name);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

// PATCH /api/custom-lists/:id — đổi tên danh mục. Body: { name }
customListRouter.patch("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = await service.renameList(req.params.id, req.body?.name);
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

// DELETE /api/custom-lists/:id — xóa cả danh mục lẫn các giá trị bên trong.
customListRouter.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await service.removeList(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    sendError(res, error);
  }
});

// POST /api/custom-lists/:id/items — thêm giá trị vào danh mục. Body: { value, price? }
customListRouter.post("/:id/items", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = await service.addItem(req.params.id, req.body?.value, req.body?.price);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

// PATCH /api/custom-lists/items/:itemId — sửa giá trị/giá hoặc ẩn/hiện. Body: { value?, active?, price? }
customListRouter.patch("/items/:itemId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = await service.updateItem(req.params.itemId, {
      value: req.body?.value,
      active: req.body?.active,
      price: req.body?.price,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

// DELETE /api/custom-lists/items/:itemId — xóa hẳn 1 giá trị.
customListRouter.delete("/items/:itemId", requireAdmin, async (req: Request, res: Response) => {
  try {
    await service.removeItem(req.params.itemId);
    res.json({ success: true });
  } catch (error: any) {
    sendError(res, error);
  }
});
