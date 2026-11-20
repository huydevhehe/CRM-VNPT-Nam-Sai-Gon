import { test } from "node:test";
import assert from "node:assert/strict";

const { initDatabase, run, query } = await import("../../database/db.js");
const { ReminderGroupSettingsService, GroupSettingsError } = await import("./reminder-group-settings.service.js");
const { ReminderSettingsService } = await import("./reminder-settings.service.js");
const { ReminderRunner } = await import("./reminder-runner.js");

await initDatabase();

async function cleanup(): Promise<void> {
  await run("DELETE FROM reminder_group_settings");
  await run("DELETE FROM reminder_logs WHERE item_id LIKE 'SVC-GRP-%'");
  await run("DELETE FROM services WHERE id LIKE 'SVC-GRP-%'");
  await run("DELETE FROM staff WHERE id LIKE 'STAFF-GRP-%'");
}

test.after(async () => {
  await cleanup();
  await ReminderSettingsService.update({ daysBefore: [30, 7, 1], notifyStaff: true, notifyCustomer: false, extraCc: "" });
});

test("chưa có cấu hình riêng: mọi nhóm theo cấu hình chung, bật, kênh email", async () => {
  await cleanup();
  await ReminderSettingsService.update({ daysBefore: [30, 7, 1] });
  const { general, groups } = await ReminderGroupSettingsService.list();
  assert.deepEqual(general, [30, 7, 1]);
  assert.deepEqual(
    groups.map((g) => g.group),
    ["BRCĐ", "CNTT", "Di động"]
  );
  for (const g of groups) {
    assert.equal(g.custom, false);
    assert.equal(g.enabled, true);
    assert.deepEqual(g.daysBefore, [30, 7, 1]);
    assert.deepEqual(g.channels, ["email"]);
  }
});

test("lưu cấu hình riêng: chuẩn hoá (bỏ trùng, giảm dần), chỉ nhóm đó đổi; đổi cấu hình chung không ảnh hưởng nhóm riêng", async () => {
  await cleanup();
  await ReminderSettingsService.update({ daysBefore: [30, 7, 1] });
  const saved = await ReminderGroupSettingsService.save("CNTT", { daysBefore: [15, 60, 7, 60, 1] });
  assert.equal(saved.group, "CNTT");
  assert.equal(saved.custom, true);
  assert.equal(saved.enabled, true);
  assert.deepEqual(saved.daysBefore, [60, 15, 7, 1]);

  let { groups } = await ReminderGroupSettingsService.list();
  assert.deepEqual(groups.find((g) => g.group === "BRCĐ")?.daysBefore, [30, 7, 1]);
  assert.equal(groups.find((g) => g.group === "BRCĐ")?.custom, false);

  await ReminderSettingsService.update({ daysBefore: [10, 3] });
  ({ groups } = await ReminderGroupSettingsService.list());
  assert.deepEqual(groups.find((g) => g.group === "CNTT")?.daysBefore, [60, 15, 7, 1]);
  assert.deepEqual(groups.find((g) => g.group === "BRCĐ")?.daysBefore, [10, 3]);

  // Dùng lại cấu hình chung.
  const reset = await ReminderGroupSettingsService.reset("CNTT");
  assert.equal(reset.custom, false);
  assert.deepEqual(reset.daysBefore, [10, 3]);
  const rows = await query("SELECT * FROM reminder_group_settings WHERE service_group = 'CNTT'");
  assert.equal(rows.length, 0);
});

test("công tắc nhóm: tắt giữ nguyên ngày đang dùng; chỉ đổi ngày giữ nguyên công tắc", async () => {
  await cleanup();
  await ReminderSettingsService.update({ daysBefore: [30, 7, 1] });
  const off = await ReminderGroupSettingsService.save("Di động", { enabled: false });
  assert.equal(off.enabled, false);
  assert.equal(off.custom, true);
  assert.deepEqual(off.daysBefore, [30, 7, 1]);
  const days = await ReminderGroupSettingsService.save("Di động", { daysBefore: [5] });
  assert.equal(days.enabled, false);
  assert.deepEqual(days.daysBefore, [5]);
  const on = await ReminderGroupSettingsService.save("Di động", { enabled: true });
  assert.equal(on.enabled, true);
  assert.deepEqual(on.daysBefore, [5]);
});

test("validate: nhóm lạ, mảng rỗng, quá 10 mốc, số âm/lẻ/chữ, enabled sai kiểu đều bị từ chối và không ghi gì", async () => {
  await cleanup();
  await assert.rejects(() => ReminderGroupSettingsService.save("Khác", { daysBefore: [1] }), GroupSettingsError);
  await assert.rejects(() => ReminderGroupSettingsService.save(undefined, { daysBefore: [1] }), GroupSettingsError);
  await assert.rejects(() => ReminderGroupSettingsService.reset("Khác"), GroupSettingsError);
  await assert.rejects(() => ReminderGroupSettingsService.save("CNTT", { daysBefore: [] }), /ít nhất 1/);
  await assert.rejects(
    () => ReminderGroupSettingsService.save("CNTT", { daysBefore: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }),
    /tối đa 10/
  );
  await assert.rejects(() => ReminderGroupSettingsService.save("CNTT", { daysBefore: [-1] }), GroupSettingsError);
  await assert.rejects(() => ReminderGroupSettingsService.save("CNTT", { daysBefore: [1.5] }), GroupSettingsError);
  await assert.rejects(() => ReminderGroupSettingsService.save("CNTT", { daysBefore: ["abc"] }), GroupSettingsError);
  await assert.rejects(() => ReminderGroupSettingsService.save("CNTT", { daysBefore: "7" }), GroupSettingsError);
  await assert.rejects(() => ReminderGroupSettingsService.save("CNTT", { enabled: "yes" }), GroupSettingsError);
  assert.equal((await query("SELECT * FROM reminder_group_settings")).length, 0);
});

test("dữ liệu ngày hỏng trong DB: nhóm rơi về cấu hình chung thay vì lỗi", async () => {
  await cleanup();
  await ReminderSettingsService.update({ daysBefore: [30, 7, 1] });
  await run(
    "INSERT INTO reminder_group_settings (service_group, enabled, days_before, channels, updated_at) VALUES ('CNTT', TRUE, 'khong-phai-json', 'x', 'x')"
  );
  const cntt = await ReminderGroupSettingsService.get("CNTT");
  assert.deepEqual(cntt.daysBefore, [30, 7, 1]);
  assert.deepEqual(cntt.channels, ["email"]);
});

async function insertStaffAndServices(suffix: string, tags: [string, string | null][]): Promise<void> {
  await run(`INSERT INTO staff (id, code, name, role, status, email) VALUES (?, ?, ?, ?, ?, ?)`, [
    `STAFF-GRP-${suffix}`,
    `CODE-GRP-${suffix}`,
    `AM Grp ${suffix}`,
    "AM",
    "Đang hoạt động",
    "am-grp@example.com",
  ]);
  for (const [tag, group] of tags) {
    await run(
      `INSERT INTO services (id, customer_name, service_name, service_code, start_date, expiration_date, staff_name, service_group)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`SVC-GRP-${tag}-${suffix}`, `KH ${tag}`, `DV-${tag}-${suffix}`, `SUB-${tag}`, "2026-01-01", "2026-12-01", `AM Grp ${suffix}`, group]
    );
  }
}

test("runner: mỗi nhóm nhắc theo mốc riêng; nhóm không riêng/không nhóm theo mốc chung; nhóm tắt thì bỏ qua", async () => {
  await cleanup();
  const suffix = `${Date.now()}`;
  // Dịch vụ cùng hết hạn 2026-12-01. Hôm nay 2026-11-17 còn 14 ngày; 2026-11-24 còn 7 ngày; 2026-10-02 còn 60 ngày.
  await insertStaffAndServices(suffix, [
    ["CNTT", "CNTT"],
    ["BRCD", "BRCĐ"],
    ["DD", "Di động"],
    ["NONE", null],
    ["ODD", "Nhóm lạ"],
  ]);
  await ReminderSettingsService.update({ notifyStaff: true, notifyCustomer: false, daysBefore: [7], extraCc: "" });
  await ReminderGroupSettingsService.save("CNTT", { daysBefore: [14, 60] });
  await ReminderGroupSettingsService.save("Di động", { enabled: false, daysBefore: [14, 7] });

  const sent: { to: string | string[]; subject: string; text: string }[] = [];
  const fakeSend = async (msg: { to: string | string[]; subject: string; text: string }) => {
    sent.push(msg);
    return { sent: true };
  };
  const names = () =>
    sent
      .filter((m) => m.subject.includes(suffix))
      .map((m) => m.subject.replace(/^.*?(DV-[A-Z]+)-.*$/, "$1"))
      .sort();

  // 14 ngày trước hạn: chỉ nhóm CNTT (riêng có 14); chung chỉ có 7.
  await ReminderRunner.run("2026-11-17", { send: fakeSend });
  assert.deepEqual(names(), ["DV-CNTT"]);

  // 7 ngày trước hạn: BRCĐ, không nhóm, nhóm lạ theo chung (7); CNTT riêng không có 7; Di động tắt dù riêng có 7.
  sent.length = 0;
  await ReminderRunner.run("2026-11-24", { send: fakeSend });
  assert.deepEqual(names(), ["DV-BRCD", "DV-NONE", "DV-ODD"]);

  // 60 ngày trước hạn: CNTT riêng có 60.
  sent.length = 0;
  await ReminderRunner.run("2026-10-02", { send: fakeSend });
  assert.deepEqual(names(), ["DV-CNTT"]);

  // Idempotent: chạy lại cùng ngày không gửi trùng.
  sent.length = 0;
  await ReminderRunner.run("2026-11-17", { send: fakeSend });
  await ReminderRunner.run("2026-11-24", { send: fakeSend });
  assert.equal(sent.length, 0);

  // Bật lại nhóm Di động rồi dùng cấu hình chung cho CNTT: mốc áp dụng đổi theo.
  await ReminderGroupSettingsService.save("Di động", { enabled: true });
  await ReminderGroupSettingsService.reset("CNTT");
  await run("DELETE FROM reminder_logs WHERE item_id LIKE 'SVC-GRP-%'");
  sent.length = 0;
  await ReminderRunner.run("2026-11-17", { send: fakeSend });
  assert.deepEqual(names(), ["DV-DD"]); // Di động riêng [14, 7] → 14 ngày khớp; CNTT về chung [7] → không khớp

  await cleanup();
});
