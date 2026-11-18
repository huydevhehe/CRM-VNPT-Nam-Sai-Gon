import { Router, Request, Response } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireAdmin } from "../../middleware/require-role.js";
import { resolveActorName, resolveStaffScope } from "../../middleware/actor.js";
import { LeadActor, LeadService, LeadServiceError } from "./lead.service.js";
import { LeadStageRequestService } from "./lead-stage-request.service.js";

export const leadRouter = Router();
const leadService = new LeadService();
const stageRequestService = new LeadStageRequestService();

function sendError(res: Response, error: any, fallbackStatus: number) {
  const status = error instanceof LeadServiceError ? error.status : fallbackStatus;
  res.status(status).json({ success: false, message: error.message });
}

// Admin: toàn quyền. AM / AM Bán chăm: chỉ thao tác Lead do chính mình phụ trách.
async function assertCanAccessLead(req: Request, id: string): Promise<void> {
  const scope = await resolveStaffScope(req);
  const lead = await leadService.getById(id);
  if (!lead) {
    throw new LeadServiceError("Không tìm thấy Lead", 404);
  }
  if (scope !== null && lead.staffName !== scope) {
    throw new LeadServiceError("Bạn chỉ được thao tác trên Lead do chính mình phụ trách", 403);
  }
}

async function resolveActor(req: Request): Promise<LeadActor> {
  const isAdmin = req.user?.role === "Admin";
  const name = (await resolveActorName(req)) ?? req.user?.id ?? "Không rõ";
  return { isAdmin, name };
}

// GET /api/leads — AM chỉ thấy Lead của mình
leadRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const scope = await resolveStaffScope(req);
    const leads = await leadService.getAll(scope ?? undefined);
    res.json({ success: true, data: leads });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/leads/ctv-options (khai báo trước mọi route /:id)
leadRouter.get("/ctv-options", async (_req: Request, res: Response) => {
  try {
    const options = await leadService.getCtvOptions();
    res.json({ success: true, data: options });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/leads/stage-requests?status=Chờ duyệt — chỉ Admin (khai báo trước mọi route /:id)
leadRouter.get("/stage-requests", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = await stageRequestService.list(req.query.status);
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// PATCH /api/leads/stage-requests/:id { action: "approve" | "reject", note? } — chỉ Admin
leadRouter.patch("/stage-requests/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { action, note } = req.body ?? {};
    const actor = await resolveActor(req);
    const data = await stageRequestService.decide(req.params.id, action, note, actor.name);
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// POST /api/leads
leadRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      customerName,
      phone,
      group,
      channel,
      channelSourceId,
      staffName,
      status,
      expectedValue,
      demandDescription,
      territoryId,
      referredByCtvId,
      note,
    } = req.body ?? {};

    // Không phải Admin: Lead chỉ được gán cho chính người tạo (bỏ trống = tự gán).
    const scope = await resolveStaffScope(req);
    let ownerName = staffName;
    if (scope !== null) {
      const requested = typeof staffName === "string" ? staffName.trim() : "";
      if (requested && requested !== scope) {
        throw new LeadServiceError("Bạn chỉ được tạo Lead gán cho chính mình", 403);
      }
      ownerName = scope;
    }

    const lead = await leadService.create({
      customerName,
      phone,
      group,
      channel,
      channelSourceId,
      staffName: ownerName,
      status,
      expectedValue: expectedValue !== undefined ? Number(expectedValue) : undefined,
      demandDescription,
      territoryId,
      referredByCtvId,
      note,
    });

    res.status(201).json({ success: true, data: lead });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// PATCH /api/leads/:id — Admin sửa thông tin chung của Lead
leadRouter.patch("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const actor = await resolveActor(req);
    const lead = await leadService.update(req.params.id, req.body ?? {}, actor);
    res.json({ success: true, data: lead });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// PATCH /api/leads/:id/status — nhân viên không được lùi bước (409); Admin đổi tự do
leadRouter.patch("/:id/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};

    await assertCanAccessLead(req, id);
    const actor = await resolveActor(req);
    const lead = await leadService.updateStatus(id, status, actor);
    res.json({ success: true, data: lead });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// POST /api/leads/:id/stage-requests { toStatus, reason } — nhân viên xin Admin duyệt quay lại bước trước
leadRouter.post("/:id/stage-requests", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { toStatus, reason } = req.body ?? {};

    await assertCanAccessLead(req, id);
    const actor = await resolveActor(req);
    if (actor.isAdmin) {
      throw new LeadServiceError("Admin cập nhật trạng thái trực tiếp, không cần gửi yêu cầu", 400);
    }
    const data = await stageRequestService.create(id, toStatus, reason, actor.name);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// PATCH /api/leads/:id/assignment — chỉ Admin được giao / đổi AM, đổi phường
leadRouter.patch("/:id/assignment", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { staffName, territoryId } = req.body ?? {};

    const lead = await leadService.assign(id, { staffName, territoryId });
    res.json({ success: true, data: lead });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// DELETE /api/leads/:id — chỉ Admin, chặn nếu Lead đã tạo đơn hàng
leadRouter.delete("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const actor = await resolveActor(req);
    await leadService.remove(req.params.id, actor);
    res.json({ success: true, message: "Đã xóa Lead" });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// PATCH /api/leads/:id/note
leadRouter.patch("/:id/note", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body ?? {};

    await assertCanAccessLead(req, id);
    const lead = await leadService.updateNote(id, typeof note === "string" ? note : "");
    res.json({ success: true, data: lead });
  } catch (error: any) {
    sendError(res, error, 400);
  }
});
