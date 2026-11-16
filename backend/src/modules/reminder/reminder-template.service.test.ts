import { test } from "node:test";
import assert from "node:assert/strict";

const { initDatabase, run, query } = await import("../../database/db.js");
const {
  renderEmail,
  validateTemplate,
  findUnknownVariables,
  TemplateValidationError,
  ReminderTemplateService,
  DEFAULT_SUBJECT_TEMPLATE,
  DEFAULT_BODY_TEMPLATE,
  TEMPLATE_VARIABLES,
} = await import("./reminder-template.service.js");
const { ReminderRunner } = await import("./reminder-runner.js");
const { ReminderSettingsService } = await import("./reminder-settings.service.js");

await initDatabase();

const DATA = {
  title: "Internet FiberVNN",
  customerName: "Công ty ABC",
  subscriberCode: "SUB-1",
  staffName: "Nguyễn Văn A",
  expiryDate: "2026-11-18",
  daysBefore: 7,
};

test.after(async () => {
  await ReminderTemplateService.reset();
  await run("DELETE FROM reminder_group_templates");
  await run("DELETE FROM reminder_logs WHERE item_id LIKE 'SVC-TPL-%'");
  await run("DELETE FROM services WHERE id LIKE 'SVC-TPL-%'");
  await run("DELETE FROM staff WHERE id LIKE 'STAFF-TPL-%'");
});

test("mẫu mặc định render đúng nội dung cũ viết cứng", () => {
  const out = renderEmail({ subject: DEFAULT_SUBJECT_TEMPLATE, body: DEFAULT_BODY_TEMPLATE }, DATA);
  assert.equal(
    out.subject,
    "[VNPT NSG] Dịch vụ Internet FiberVNN của Công ty ABC hết hạn ngày 18/11/2026 (còn 7 ngày)"
  );
  assert.equal(
    out.text,
    [
      "Dịch vụ: Internet FiberVNN",
      "Khách hàng: Công ty ABC",
      "Mã thuê bao: SUB-1",
      "AM phụ trách: Nguyễn Văn A",
      "Ngày hết hạn: 18/11/2026 (còn 7 ngày)",
    ].join("\n")
  );
});

test("giá trị rỗng dùng chữ thay thế (không có / chưa gán)", () => {
  const out = renderEmail(
    { subject: "x", body: "{mã thuê bao}|{AM phụ trách}" },
    { ...DATA, subscriberCode: "", staffName: null }
  );
  assert.equal(out.text, "(không có)|(chưa gán)");
});

test("thay đủ các biến trong tiêu đề và nội dung", () => {
  const out = renderEmail(
    {
      subject: "{tên khách} - {dịch vụ} - {ngày hết hạn} - {số ngày còn lại}",
      body: "{mã thuê bao} {AM phụ trách}",
    },
    DATA
  );
  assert.equal(out.subject, "Công ty ABC - Internet FiberVNN - 18/11/2026 - 7");
  assert.equal(out.text, "SUB-1 Nguyễn Văn A");
  assert.equal(TEMPLATE_VARIABLES.length, 6);
});

test("giá trị chèn vào html bị escape, text giữ nguyên", () => {
  const out = renderEmail(
    { subject: "{tên khách}", body: "Khách: {tên khách}" },
    { ...DATA, customerName: `<script>alert("x")</script> & 'Co'` }
  );
  assert.ok(!out.html.includes("<script>"));
  assert.ok(out.html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;Co&#39;"));
  assert.ok(out.text.includes(`<script>alert("x")</script>`));
});

test("văn bản người dùng nhập cũng bị escape; xuống dòng thành <br>", () => {
  const out = renderEmail({ subject: "s", body: "<b>Chào</b>\r\nDòng 2\nDòng 3" }, DATA);
  assert.ok(out.html.includes("&lt;b&gt;Chào&lt;/b&gt;<br>Dòng 2<br>Dòng 3"));
  assert.ok(!out.html.includes("<b>"));
  assert.equal(out.text, "<b>Chào</b>\r\nDòng 2\nDòng 3");
});

test("tiêu đề không bao giờ chứa xuống dòng dù tên khách có xuống dòng", () => {
  const out = renderEmail({ subject: "KH: {tên khách}", body: "b" }, { ...DATA, customerName: "A\r\nBcc: x@evil.com" });
  assert.ok(!/[\r\n]/.test(out.subject));
});

test("biến lạ khi render được giữ nguyên chữ", () => {
  const out = renderEmail({ subject: "{lạ} {tên khách}", body: "{abc}" }, DATA);
  assert.equal(out.subject, "{lạ} Công ty ABC");
  assert.equal(out.text, "{abc}");
});

test("findUnknownVariables liệt kê biến lạ không trùng", () => {
  assert.deepEqual(findUnknownVariables("{tên khách} {x} {y} {x} { dịch vụ }"), ["x", "y"]);
  assert.deepEqual(findUnknownVariables("không có biến, { chưa đóng"), []);
});

test("validateTemplate chặn rỗng, quá dài, nhiều dòng, biến lạ", () => {
  assert.throws(() => validateTemplate({ subject: "  ", body: "ok" }), /Tiêu đề không được để trống/);
  assert.throws(() => validateTemplate({ subject: "ok", body: "   " }), /Nội dung không được để trống/);
  assert.throws(() => validateTemplate({ subject: "a".repeat(201), body: "ok" }), /tối đa 200/);
  assert.throws(() => validateTemplate({ subject: "ok", body: "a".repeat(5001) }), /tối đa 5000/);
  assert.throws(() => validateTemplate({ subject: "a\nb", body: "ok" }), /một dòng/);
  assert.throws(() => validateTemplate({ subject: 123, body: "ok" }), TemplateValidationError);
  assert.throws(
    () => validateTemplate({ subject: "{sai1}", body: "{tên khách} {sai2}" }),
    (err: Error) =>
      err instanceof TemplateValidationError &&
      err.message.includes("{sai1}") &&
      err.message.includes("{sai2}") &&
      err.message.includes("{tên khách}")
  );
  const ok = validateTemplate({ subject: "a".repeat(200), body: "a".repeat(5000) });
  assert.equal(ok.subject.length, 200);
});

test("chưa cấu hình thì getEffective trả mặc định; lưu rồi đọc lại; reset về mặc định", async () => {
  await ReminderTemplateService.reset();
  const initial = await ReminderTemplateService.getView();
  assert.equal(initial.isDefault, true);
  assert.equal(initial.subject, DEFAULT_SUBJECT_TEMPLATE);
  assert.equal(initial.body, DEFAULT_BODY_TEMPLATE);
  assert.equal(initial.variables.length, 6);

  const saved = await ReminderTemplateService.save({ subject: "Nhắc {dịch vụ}", body: "Chào {tên khách}\nHết hạn {ngày hết hạn}" });
  assert.equal(saved.isDefault, false);
  const effective = await ReminderTemplateService.getEffective();
  assert.equal(effective.subject, "Nhắc {dịch vụ}");
  assert.equal(effective.body, "Chào {tên khách}\nHết hạn {ngày hết hạn}");

  await assert.rejects(() => ReminderTemplateService.save({ subject: "{sai}", body: "x" }), TemplateValidationError);
  assert.equal((await ReminderTemplateService.getEffective()).subject, "Nhắc {dịch vụ}");

  const reset = await ReminderTemplateService.reset();
  assert.equal(reset.isDefault, true);
  assert.equal(reset.subject, DEFAULT_SUBJECT_TEMPLATE);
  const rows = await query<{ email_subject_template: string | null }>(
    "SELECT email_subject_template FROM reminder_settings WHERE id = 'default'"
  );
  assert.equal(rows[0].email_subject_template, null);
});

test("preview dùng mẫu đang soạn hoặc mẫu đã lưu", async () => {
  await ReminderTemplateService.reset();
  const saved = await ReminderTemplateService.preview({});
  assert.ok(saved.subject.startsWith("[VNPT NSG] Dịch vụ Internet cáp quang FiberVNN của Công ty TNHH ABC"));
  const draft = await ReminderTemplateService.preview({ subject: "Thử {tên khách}", body: "Nội dung {số ngày còn lại}" });
  assert.equal(draft.subject, "Thử Công ty TNHH ABC");
  assert.equal(draft.text, "Nội dung 7");
  await assert.rejects(() => ReminderTemplateService.preview({ subject: "{sai}", body: "x" }), TemplateValidationError);
});

test("sendTest gửi qua hàm send giả, gắn nhãn [Gửi thử], kiểm tra email", async () => {
  const calls: { to: string | string[]; subject: string; text: string; html?: string }[] = [];
  const fakeSend = async (msg: { to: string | string[]; subject: string; text: string; html?: string }) => {
    calls.push(msg);
    return { sent: true };
  };
  const result = await ReminderTemplateService.sendTest("khach@example.com", { subject: "Chào {tên khách}", body: "x" }, fakeSend);
  assert.equal(result.sent, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, "khach@example.com");
  assert.equal(calls[0].subject, "[Gửi thử] Chào Công ty TNHH ABC");

  await assert.rejects(() => ReminderTemplateService.sendTest("khong-hop-le", {}, fakeSend), TemplateValidationError);
  assert.equal(calls.length, 1);
});

test("runner dùng mẫu đã lưu khi gửi, và dùng mặc định khi đã reset", async () => {
  await run("DELETE FROM reminder_logs WHERE item_id LIKE 'SVC-TPL-%'");
  await run("DELETE FROM services WHERE id LIKE 'SVC-TPL-%'");
  await run("DELETE FROM staff WHERE id LIKE 'STAFF-TPL-%'");
  const suffix = `${Date.now()}`;
  await run(`INSERT INTO staff (id, code, name, role, status, email) VALUES (?, ?, ?, ?, ?, ?)`, [
    `STAFF-TPL-${suffix}`,
    `CODE-TPL-${suffix}`,
    `AM Tpl ${suffix}`,
    "AM",
    "Đang hoạt động",
    "am-tpl@example.com",
  ]);
  await run(
    `INSERT INTO services (id, customer_name, service_name, service_code, start_date, expiration_date, staff_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [`SVC-TPL-${suffix}`, `<i>KH</i> ${suffix}`, "DV Tpl", "SUB-TPL", "2026-01-01", "2026-11-18", `AM Tpl ${suffix}`]
  );
  await ReminderSettingsService.update({ notifyStaff: true, notifyCustomer: false, daysBefore: [7], extraCc: "" });

  await ReminderTemplateService.save({ subject: "MẪU MỚI {dịch vụ} / {số ngày còn lại}", body: "Gửi {tên khách}\nAM: {AM phụ trách}" });
  const sent: { to: string | string[]; subject: string; text: string; html?: string }[] = [];
  const fakeSend = async (msg: { to: string | string[]; subject: string; text: string; html?: string }) => {
    sent.push(msg);
    return { sent: true };
  };
  await ReminderRunner.run("2026-11-11", { send: fakeSend });
  const mine = sent.filter((m) => m.subject.includes("DV Tpl"));
  assert.equal(mine.length, 1);
  assert.equal(mine[0].subject, "MẪU MỚI DV Tpl / 7");
  assert.equal(mine[0].text, `Gửi <i>KH</i> ${suffix}\nAM: AM Tpl ${suffix}`);
  assert.ok(mine[0].html?.includes(`&lt;i&gt;KH&lt;/i&gt; ${suffix}<br>AM:`));

  await ReminderTemplateService.reset();
  await run("DELETE FROM reminder_logs WHERE item_id LIKE 'SVC-TPL-%'");
  sent.length = 0;
  await ReminderRunner.run("2026-11-11", { send: fakeSend });
  const again = sent.filter((m) => m.subject.includes("DV Tpl"));
  assert.equal(again.length, 1);
  assert.ok(again[0].subject.startsWith("[VNPT NSG] Dịch vụ DV Tpl của"));
});

test("mẫu theo nhóm: chưa có mẫu riêng thì theo mẫu chung; lưu riêng không đổi mẫu chung; reset nhóm về mẫu chung", async () => {
  await ReminderTemplateService.reset();
  await ReminderTemplateService.reset("CNTT");
  await ReminderTemplateService.save({ subject: "CHUNG {dịch vụ}", body: "Mẫu chung {tên khách}" });

  const before = await ReminderTemplateService.getView("CNTT");
  assert.equal(before.group, "CNTT");
  assert.equal(before.isDefault, true);
  assert.equal(before.subject, "CHUNG {dịch vụ}");
  assert.equal(before.defaultSubject, "CHUNG {dịch vụ}");

  const saved = await ReminderTemplateService.save({ subject: "CNTT {dịch vụ}", body: "Riêng CNTT {tên khách}" }, "CNTT");
  assert.equal(saved.isDefault, false);
  assert.equal(saved.subject, "CNTT {dịch vụ}");
  assert.equal((await ReminderTemplateService.getEffective()).subject, "CHUNG {dịch vụ}");
  assert.equal((await ReminderTemplateService.getEffective("CNTT")).body, "Riêng CNTT {tên khách}");
  assert.equal((await ReminderTemplateService.getEffective("BRCĐ")).subject, "CHUNG {dịch vụ}");

  await assert.rejects(() => ReminderTemplateService.save({ subject: "{sai}", body: "x" }, "CNTT"), TemplateValidationError);
  assert.equal((await ReminderTemplateService.getEffective("CNTT")).subject, "CNTT {dịch vụ}");

  const reset = await ReminderTemplateService.reset("CNTT");
  assert.equal(reset.isDefault, true);
  assert.equal((await ReminderTemplateService.getEffective("CNTT")).subject, "CHUNG {dịch vụ}");
  await ReminderTemplateService.reset();
});

test("nhóm dịch vụ không hợp lệ bị từ chối ở mọi thao tác; rỗng/null là mẫu chung", async () => {
  await assert.rejects(() => ReminderTemplateService.getView("Khác"), /Nhóm dịch vụ không hợp lệ/);
  await assert.rejects(() => ReminderTemplateService.save({ subject: "a", body: "b" }, "Khác"), TemplateValidationError);
  await assert.rejects(() => ReminderTemplateService.reset("Khác"), TemplateValidationError);
  await assert.rejects(() => ReminderTemplateService.preview({}, "Khác"), TemplateValidationError);
  await assert.rejects(() => ReminderTemplateService.sendTest("a@b.co", {}, undefined, "Khác"), TemplateValidationError);
  assert.equal((await ReminderTemplateService.getView(null)).group, null);
  assert.equal((await ReminderTemplateService.getView("")).group, null);
});

test("preview và sendTest theo nhóm dùng mẫu riêng của nhóm", async () => {
  await ReminderTemplateService.reset();
  await ReminderTemplateService.save({ subject: "CHUNG {dịch vụ}", body: "x" });
  await ReminderTemplateService.save({ subject: "DĐ {dịch vụ}", body: "y" }, "Di động");
  assert.equal((await ReminderTemplateService.preview({}, "Di động")).subject, "DĐ Internet cáp quang FiberVNN");
  assert.equal((await ReminderTemplateService.preview({})).subject, "CHUNG Internet cáp quang FiberVNN");

  const calls: { subject: string }[] = [];
  const fakeSend = async (msg: { to: string | string[]; subject: string; text: string }) => {
    calls.push(msg);
    return { sent: true };
  };
  await ReminderTemplateService.sendTest("a@b.co", {}, fakeSend, "Di động");
  assert.equal(calls[0].subject, "[Gửi thử] DĐ Internet cáp quang FiberVNN");
  await ReminderTemplateService.reset("Di động");
  await ReminderTemplateService.reset();
});

test("runner chọn mẫu theo nhóm dịch vụ; nhóm chưa có mẫu riêng hoặc không có nhóm thì dùng mẫu chung", async () => {
  await run("DELETE FROM reminder_logs WHERE item_id LIKE 'SVC-TPL-%'");
  await run("DELETE FROM services WHERE id LIKE 'SVC-TPL-%'");
  await run("DELETE FROM staff WHERE id LIKE 'STAFF-TPL-%'");
  const suffix = `${Date.now()}`;
  await run(`INSERT INTO staff (id, code, name, role, status, email) VALUES (?, ?, ?, ?, ?, ?)`, [
    `STAFF-TPL-G-${suffix}`,
    `CODE-TPL-G-${suffix}`,
    `AM Nhóm ${suffix}`,
    "AM",
    "Đang hoạt động",
    "am-nhom@example.com",
  ]);
  const groups: [string, string | null][] = [
    ["CNTT", "CNTT"],
    ["BRCĐ", "BRCĐ"],
    ["TRONG", null],
    ["LA", "Nhóm lạ"],
  ];
  for (const [tag, group] of groups) {
    await run(
      `INSERT INTO services (id, customer_name, service_name, service_code, start_date, expiration_date, staff_name, service_group)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`SVC-TPL-G-${tag}-${suffix}`, `KH ${tag}`, `DV-${tag}-${suffix}`, `SUB-${tag}`, "2026-01-01", "2026-11-18", `AM Nhóm ${suffix}`, group]
    );
  }
  await ReminderSettingsService.update({ notifyStaff: true, notifyCustomer: false, daysBefore: [7], extraCc: "" });
  await ReminderTemplateService.reset();
  await ReminderTemplateService.reset("CNTT");
  await ReminderTemplateService.save({ subject: "CHUNG {dịch vụ}", body: "chung" });
  await ReminderTemplateService.save({ subject: "CNTT {dịch vụ}", body: "riêng" }, "CNTT");

  const sent: { to: string | string[]; subject: string; text: string }[] = [];
  const fakeSend = async (msg: { to: string | string[]; subject: string; text: string }) => {
    sent.push(msg);
    return { sent: true };
  };
  await ReminderRunner.run("2026-11-11", { send: fakeSend });
  const bySubject = (tag: string) => sent.find((m) => m.subject.includes(`DV-${tag}-${suffix}`));
  assert.equal(bySubject("CNTT")?.subject, `CNTT DV-CNTT-${suffix}`);
  assert.equal(bySubject("CNTT")?.text, "riêng");
  assert.equal(bySubject("BRCĐ")?.subject, `CHUNG DV-BRCĐ-${suffix}`);
  assert.equal(bySubject("TRONG")?.subject, `CHUNG DV-TRONG-${suffix}`);
  assert.equal(bySubject("LA")?.subject, `CHUNG DV-LA-${suffix}`);

  await ReminderTemplateService.reset("CNTT");
  await ReminderTemplateService.reset();
});
