import { query, run } from "../db.js";
import { runMigrationOnce } from "../schema-extensions.js";

/** Nguồn Online mẫu khách nêu; Admin tự thêm "Website A/B…" ở trang Danh mục kênh. */
const DEFAULT_ONLINE_SOURCES = ["Zalo Ads", "Facebook", "Website"] as const;

/**
 * Schema của Lead + Danh mục kênh dùng chung (chỉ thêm, chạy lặp lại không lỗi):
 * - bảng `channel_sources` (nguồn Online / Đối tác) và cột `leads.channel_source_id`
 * - bảng `lead_stage_requests` (yêu cầu quay lại bước trước, chờ Admin duyệt)
 */
export async function applyLeadChannelSchema(): Promise<void> {
  await run(`
    CREATE TABLE IF NOT EXISTS channel_sources (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT
    )
  `);
  await run(
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_sources_kind_name ON channel_sources(kind, LOWER(name))"
  );

  await run("ALTER TABLE leads ADD COLUMN IF NOT EXISTS channel_source_id TEXT");

  await run(`
    CREATE TABLE IF NOT EXISTS lead_stage_requests (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      reason TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Chờ duyệt',
      decided_by TEXT,
      decided_at TEXT,
      decision_note TEXT,
      created_at TEXT
    )
  `);
  // Mỗi Lead chỉ có tối đa một yêu cầu đang chờ duyệt (chặn cả khi gửi đồng thời).
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_lead_stage_requests_pending
    ON lead_stage_requests(lead_id) WHERE status = 'Chờ duyệt'
  `);
  await run(
    "CREATE INDEX IF NOT EXISTS ix_lead_stage_requests_status ON lead_stage_requests(status, created_at)"
  );

  await runMigrationOnce("channel_sources_seed_v1", async () => {
    const now = new Date().toISOString();
    let order = 1;
    for (const name of DEFAULT_ONLINE_SOURCES) {
      const exists = await query<{ id: string }>(
        "SELECT id FROM channel_sources WHERE kind = 'online' AND LOWER(name) = LOWER(?)",
        [name]
      );
      if (exists.length) {
        continue;
      }
      await run(
        "INSERT INTO channel_sources (id, kind, name, active, sort_order, created_at) VALUES (?, 'online', ?, TRUE, ?, ?)",
        [`CHS-SEED-${order}`, name, order, now]
      );
      order += 1;
    }
  });
}
