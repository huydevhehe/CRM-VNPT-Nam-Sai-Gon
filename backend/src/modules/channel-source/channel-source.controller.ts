import { Router, Request, Response } from "express";
import { requireAdmin } from "../../middleware/require-role.js";
import { resolveActorName } from "../../middleware/actor.js";
import { run } from "../../database/db.js";
import { ChannelSourceService, ChannelSourceError } from "./channel-source.service.js";

export const channelSourceRouter = Router();
const service = new ChannelSourceService();

function sendError(res: Response, error: any, fallbackStatus = 500) {
  const status = error instanceof ChannelSourceError ? error.status : fallbackStatus;
  res.status(status).json({ success: false, message: error.message });
}

async function audit(req: Request, action: string, details: string): Promise<void> {
  const user = (await resolveActorName(req)) ?? req.user?.id ?? "Hệ thống";
  await run('INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)', [
    `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user,
    action,
    details,
  ]);
}

// GET /api/channel-sources?kind=online|partner&includeInactive=true
// Mọi nhân viên đăng nhập đều đọc được (để chọn chi tiết kênh); chỉ Admin xem được mục đã ẩn.
channelSourceRouter.get("/", async (req: Request, res: Response) => {
  try {
    const wantInactive = String(req.query.includeInactive ?? "") === "true";
    const data = await service.list({
      kind: req.query.kind,
      includeInactive: wantInactive && req.user?.role === "Admin",
    });
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// POST /api/channel-sources — chỉ Admin
channelSourceRouter.post("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const item = await service.create(req.body ?? {});
    await audit(
      req,
      "Thêm danh mục kênh",
      `Thêm ${item.kind === "online" ? "nguồn Online" : "đối tác"} "${item.name}"`
    );
    res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// POST /api/channel-sources/reorder { kind, orderedIds } — khai báo trước các route /:id
channelSourceRouter.post("/reorder", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { kind, orderedIds } = req.body ?? {};
    const data = await service.reorder(kind, orderedIds);
    await audit(req, "Sắp xếp danh mục kênh", `Đổi thứ tự danh mục kênh loại ${kind}`);
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// PATCH /api/channel-sources/:id — đổi tên / ẩn-hiện / thứ tự, chỉ Admin
channelSourceRouter.patch("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const item = await service.update(req.params.id, req.body ?? {});
    await audit(req, "Sửa danh mục kênh", `Cập nhật "${item.name}" (${item.active ? "đang hiện" : "đã ẩn"})`);
    res.json({ success: true, data: item });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// DELETE /api/channel-sources/:id — chỉ Admin; đã dùng thì chuyển sang ẩn
channelSourceRouter.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await service.remove(req.params.id);
    await audit(req, result.deleted ? "Xóa danh mục kênh" : "Ẩn danh mục kênh", result.message);
    res.json({ success: true, data: result, message: result.message });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});
