import { Router, Request, Response } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireAdmin } from "../../middleware/require-role.js";
import { resolveStaffScope } from "../../middleware/actor.js";
import { LeadService, LeadServiceError } from "./lead.service.js";

export const leadRouter = Router();
const leadService = new LeadService();

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

// POST /api/leads
leadRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      customerName,
      phone,
      group,
      channel,
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

// PATCH /api/leads/:id/status
leadRouter.patch("/:id/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};

    await assertCanAccessLead(req, id);
    const lead = await leadService.updateStatus(id, status);
    res.json({ success: true, data: lead });
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
