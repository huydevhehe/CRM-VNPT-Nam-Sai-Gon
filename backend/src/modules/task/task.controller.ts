import { Router, Request, Response } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { resolveStaffScope } from "../../middleware/actor.js";
import { TaskService } from "./task.service.js";

export const taskRouter = Router();
const taskService = new TaskService();

// GET /api/tasks — AM chỉ thấy công việc được giao cho mình
taskRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const scope = await resolveStaffScope(req);
    const tasks = await taskService.getAll(scope ?? undefined);
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/tasks
taskRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, relatedTarget, assignee, dueDate, priority, status, notes } = req.body ?? {};

    // Không phải Admin: chỉ tạo việc cho chính mình (bỏ trống = tự giao).
    const scope = await resolveStaffScope(req);
    let finalAssignee = assignee;
    if (scope !== null) {
      const requested = typeof assignee === "string" ? assignee.trim() : "";
      if (requested && requested !== scope) {
        res.status(403).json({ success: false, message: "Bạn chỉ được tạo công việc cho chính mình" });
        return;
      }
      finalAssignee = scope;
    }

    const task = await taskService.create({
      title,
      relatedTarget,
      assignee: finalAssignee,
      dueDate,
      priority,
      status,
      notes,
    });

    res.status(201).json({ success: true, data: task });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/tasks/:id/status
taskRouter.patch("/:id/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};

    const scope = await resolveStaffScope(req);
    if (scope !== null) {
      const existing = await taskService.getById(id);
      if (!existing) {
        res.status(404).json({ success: false, message: "Không tìm thấy công việc" });
        return;
      }
      if (existing.assignee !== scope) {
        res.status(403).json({ success: false, message: "Bạn chỉ được cập nhật công việc được giao cho mình" });
        return;
      }
    }

    const task = await taskService.updateStatus(id, status);
    res.json({ success: true, data: task });
  } catch (error: any) {
    const statusCode = error.message === "Không tìm thấy công việc" ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
});
