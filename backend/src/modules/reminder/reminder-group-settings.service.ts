import { query, run } from "../../database/db.js";
import { SERVICE_GROUPS, type ServiceGroup } from "../../constants/org.js";
import { normalizeDaysBefore, ReminderSettingsService } from "./reminder-settings.service.js";

/** Kênh nhắc hiện có. Kênh khác (ZNS, Zalo Group) sẽ thêm ở nhiệm vụ sau, chưa hiện trên giao diện. */
export const DEFAULT_CHANNELS = ["email"] as const;

export class GroupSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroupSettingsError";
  }
}

interface GroupSettingsRow {
  service_group: string;
  enabled: boolean;
  days_before: string;
  channels: string | null;
  updated_at: string | null;
}

export interface GroupReminderConfig {
  /** Nhóm có dòng cấu hình riêng (true) hay đang dùng cấu hình chung (false). */
  custom: boolean;
  /** Bật/tắt nhắc cho nhóm; nhóm dùng cấu hình chung luôn bật. */
  enabled: boolean;
  /** Các mốc ngày thực tế được áp dụng cho nhóm (riêng hoặc chung), giảm dần. */
  daysBefore: number[];
  channels: string[];
}

export interface GroupReminderView extends GroupReminderConfig {
  group: ServiceGroup;
}

export interface GroupSettingsInput {
  enabled?: unknown;
  daysBefore?: unknown;
}

function parseGroup(group: unknown): ServiceGroup {
  if (typeof group === "string" && (SERVICE_GROUPS as readonly string[]).includes(group)) {
    return group as ServiceGroup;
  }
  throw new GroupSettingsError(`Nhóm dịch vụ không hợp lệ. Các nhóm hợp lệ: ${SERVICE_GROUPS.join(", ")}`);
}

function parseDays(raw: string, fallback: number[]): number[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const numbers = parsed.filter((n) => typeof n === "number");
      if (numbers.length > 0) return numbers;
    }
  } catch {
    // dữ liệu hỏng → rơi về cấu hình chung
  }
  return fallback;
}

function parseChannels(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? "");
    if (Array.isArray(parsed)) {
      const channels = parsed.filter((c): c is string => typeof c === "string");
      if (channels.length > 0) return channels;
    }
  } catch {
    // dùng mặc định
  }
  return [...DEFAULT_CHANNELS];
}

function toConfig(row: GroupSettingsRow | undefined, generalDays: number[]): GroupReminderConfig {
  if (!row) {
    return { custom: false, enabled: true, daysBefore: generalDays, channels: [...DEFAULT_CHANNELS] };
  }
  return {
    custom: true,
    enabled: Boolean(row.enabled),
    daysBefore: parseDays(row.days_before, generalDays),
    channels: parseChannels(row.channels),
  };
}

export const ReminderGroupSettingsService = {
  /** Cấu hình nhắc của từng nhóm (đủ cả 3 nhóm), kèm cấu hình chung để giao diện hiển thị. */
  async list(): Promise<{ general: number[]; groups: GroupReminderView[] }> {
    const general = (await ReminderSettingsService.get()).daysBefore;
    const configs = await ReminderGroupSettingsService.getAll(general);
    return {
      general,
      groups: SERVICE_GROUPS.map((group) => ({ group, ...(configs.get(group) as GroupReminderConfig) })),
    };
  },

  /** Đọc một lần cho cả lượt gửi: nhóm → cấu hình hiệu lực (đủ mọi nhóm hợp lệ). */
  async getAll(generalDays?: number[]): Promise<Map<string, GroupReminderConfig>> {
    const general = generalDays ?? (await ReminderSettingsService.get()).daysBefore;
    const rows = await query<GroupSettingsRow>("SELECT * FROM reminder_group_settings");
    const byGroup = new Map(rows.map((r) => [r.service_group, r]));
    const result = new Map<string, GroupReminderConfig>();
    for (const group of SERVICE_GROUPS) {
      result.set(group, toConfig(byGroup.get(group), general));
    }
    return result;
  },

  async save(group: unknown, input: GroupSettingsInput): Promise<GroupReminderView> {
    const parsed = parseGroup(group);
    if (input.enabled !== undefined && typeof input.enabled !== "boolean") {
      throw new GroupSettingsError("enabled phải là true/false");
    }
    const existing = (await query<GroupSettingsRow>("SELECT * FROM reminder_group_settings WHERE service_group = ?", [parsed]))[0];
    const generalDays = (await ReminderSettingsService.get()).daysBefore;

    let daysBefore: number[];
    if (input.daysBefore !== undefined) {
      try {
        daysBefore = normalizeDaysBefore(input.daysBefore);
      } catch (error) {
        throw new GroupSettingsError(error instanceof Error ? error.message : "Số ngày nhắc không hợp lệ");
      }
    } else {
      daysBefore = existing ? parseDays(existing.days_before, generalDays) : generalDays;
    }
    const enabled = input.enabled !== undefined ? input.enabled : existing ? Boolean(existing.enabled) : true;

    await run(
      `INSERT INTO reminder_group_settings (service_group, enabled, days_before, channels, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (service_group) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         days_before = EXCLUDED.days_before,
         updated_at = EXCLUDED.updated_at`,
      [parsed, enabled, JSON.stringify(daysBefore), JSON.stringify(DEFAULT_CHANNELS), new Date().toISOString()]
    );
    return ReminderGroupSettingsService.get(parsed);
  },

  /** "Dùng cấu hình chung": xoá dòng riêng của nhóm. */
  async reset(group: unknown): Promise<GroupReminderView> {
    const parsed = parseGroup(group);
    await run("DELETE FROM reminder_group_settings WHERE service_group = ?", [parsed]);
    return ReminderGroupSettingsService.get(parsed);
  },

  async get(group: unknown): Promise<GroupReminderView> {
    const parsed = parseGroup(group);
    const configs = await ReminderGroupSettingsService.getAll();
    return { group: parsed, ...(configs.get(parsed) as GroupReminderConfig) };
  },
};
