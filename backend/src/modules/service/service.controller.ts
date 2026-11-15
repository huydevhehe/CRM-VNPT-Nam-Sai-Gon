import { Router, Request, Response } from "express";
import { requireAdmin } from "../../middleware/require-role.js";
import { resolveStaffScope } from "../../middleware/actor.js";
import { ServiceService, ServiceServiceError } from "./service.service.js";

export const serviceRouter = Router();
const serviceService = new ServiceService();

function sendError(res: Response, error: any) {
  const status = error instanceof ServiceServiceError ? error.status : 500;
  res.status(status).json({ success: false, message: error.message });
}

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
