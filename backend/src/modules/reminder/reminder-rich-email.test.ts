import { test } from "node:test";
import assert from "node:assert/strict";

const { initDatabase, run, query } = await import("../../database/db.js");
const {
  validateTemplate,
  ReminderTemplateService,
  ReminderSignatureService,
  TemplateValidationError,
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_SUBJECT_TEMPLATE,
} = await import("./reminder-template.service.js");
const { ReminderRunner } = await import("./reminder-runner.js");
const { ReminderSettingsService } = await import("./reminder-settings.service.js");

await initDatabase();

test.after(async () => {
  await run("UPDATE reminder_settings SET signature_enabled = FALSE, signature_html = NULL WHERE id = 'default'");
  await ReminderTemplateService.reset();
  await run("DELETE FROM reminder_group_templates");
  await run("DELETE FROM reminder_logs WHERE item_id LIKE 'SVC-RICH-%'");
  await run("DELETE FROM services WHERE id LIKE 'SVC-RICH-%'");
  await run("DELETE FROM staff WHERE id LIKE 'STAFF-RICH-%'");
});

test("validateTemplate: làm sạch HTML khi lưu (script, onerror, javascript:, thẻ lạ bị loại)", () => {
  const out = validateTemplate({
    subject: "s",
    body:
      '<p onmouseover="x()">Chào <b>a</b></p><script>alert(1)</script><img src=x onerror=alert(1)>' +
      '<a href="javascript:alert(1)">bấm</a><a href="https://vnpt.vn/x?a=1&b=2">ok</a><iframe src="//evil"></iframe>' +
      '<span style="color:red;position:fixed;background:url(x)">đỏ</span>',
  });
  assert.ok(!/<script|alert\(1\)|onerror|onmouseover|javascript:|<img|<iframe|position|url\(/i.test(out.body), out.body);
  assert.ok(out.body.includes("<b>a</b>"));
  assert.ok(out.body.includes('<a href="https://vnpt.vn/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">ok</a>'));
  assert.ok(out.body.includes('<span style="color: red">đỏ</span>'));
});

test("validateTemplate: nội dung chỉ có thẻ rỗng bị từ chối; biến lạ trong đoạn có định dạng bị báo; biến chen thẻ được giữ", () => {
  assert.throws(() => validateTemplate({ subject: "s", body: "<p></p><script>x</script>" }), /Nội dung không được để trống/);
  assert.throws(() => validateTemplate({ subject: "s", body: "<p><b>{sai}</b></p>" }), /\{sai\}/);
  const nested = validateTemplate({ subject: "s", body: "<p>{tên <b>khách</b>}</p>" });
  assert.ok(nested.body.includes("<b>khách</b>"));
});

test("giới hạn: chữ tối đa 5000 ký tự (không tính thẻ); HTML quá dài bị từ chối", () => {
  validateTemplate({ subject: "s", body: `<p><b>${"a".repeat(5000)}</b></p>` });
  assert.throws(() => validateTemplate({ subject: "s", body: `<p>${"a".repeat(5001)}</p>` }), /tối đa 5000/);
  const manyTags = "<p><b>a</b></p>".repeat(1500);
  assert.throws(() => validateTemplate({ subject: "s", body: manyTags }), /quá dài/);
});

test("mẫu cũ lưu dạng văn bản thuần (chưa có định dạng) vẫn hiển thị đúng, xuống dòng thành <br>", async () => {
  await ReminderTemplateService.reset();
  await run(
    "UPDATE reminder_settings SET email_subject_template = ?, email_body_template = ?, email_body_format = NULL WHERE id = 'default'",
    ["Cũ {dịch vụ}", "Dòng 1 {tên khách}\nDòng 2 <b>không đậm</b>\n\nĐoạn mới"]
  );
  const view = await ReminderTemplateService.getView();
  assert.equal(view.isDefault, false);
  assert.equal(view.body, "<p>Dòng 1 {tên khách}<br>Dòng 2 &lt;b&gt;không đậm&lt;/b&gt;</p><p>Đoạn mới</p>");

  await run(
    `INSERT INTO reminder_group_templates (service_group, email_subject_template, email_body_template, updated_at)
     VALUES ('CNTT', 'S', 'a
b', 'x') ON CONFLICT (service_group) DO UPDATE SET email_body_template = 'a
b', email_body_format = NULL`
  );
  assert.equal((await ReminderTemplateService.getEffective("CNTT")).body, "<p>a<br>b</p>");
  await ReminderTemplateService.reset("CNTT");
  await ReminderTemplateService.reset();
});

test("mẫu cũ đúng bằng mặc định văn bản vẫn được nhận là mặc định", async () => {
  await ReminderTemplateService.reset();
  await run(
    "UPDATE reminder_settings SET email_subject_template = ?, email_body_template = ?, email_body_format = NULL WHERE id = 'default'",
    [
      DEFAULT_SUBJECT_TEMPLATE,
      [
        "Dịch vụ: {dịch vụ}",
        "Khách hàng: {tên khách}",
        "Mã thuê bao: {mã thuê bao}",
        "AM phụ trách: {AM phụ trách}",
        "Ngày hết hạn: {ngày hết hạn} (còn {số ngày còn lại} ngày)",
      ].join("\n"),
    ]
  );
  assert.equal((await ReminderTemplateService.getView()).isDefault, true);
  await ReminderTemplateService.reset();
});

test("lưu HTML rồi đọc lại; reset về mặc định HTML; lưu đúng mặc định vẫn là mặc định", async () => {
  await ReminderTemplateService.reset();
  const saved = await ReminderTemplateService.save({
    subject: "s",
    body: '<p><strong>Kính gửi</strong> <span style="color:#0a66c2">{tên khách}</span></p>',
  });
  assert.equal(saved.body, '<p><strong>Kính gửi</strong> <span style="color: #0a66c2">{tên khách}</span></p>');
  assert.equal(saved.isDefault, false);
  assert.equal((await ReminderTemplateService.getEffective()).body, saved.body);
  const rows = await query<{ email_body_format: string }>("SELECT email_body_format FROM reminder_settings WHERE id = 'default'");
  assert.equal(rows[0].email_body_format, "html");

  const defaults = await ReminderTemplateService.reset();
  assert.equal(defaults.isDefault, true);
  assert.equal(defaults.body, DEFAULT_BODY_TEMPLATE);
  assert.ok(DEFAULT_BODY_TEMPLATE.startsWith("<p>Dịch vụ: {dịch vụ}<br>"));
  const again = await ReminderTemplateService.save({ subject: DEFAULT_SUBJECT_TEMPLATE, body: DEFAULT_BODY_TEMPLATE });
  assert.equal(again.isDefault, true);
  await ReminderTemplateService.reset();
});

test("mẫu nhóm lưu HTML riêng, mẫu chung không đổi", async () => {
  await ReminderTemplateService.reset();
  await ReminderTemplateService.reset("CNTT");
  await ReminderTemplateService.save({ subject: "chung", body: "<p>chung</p>" });
  const saved = await ReminderTemplateService.save({ subject: "cntt", body: "<p><u>riêng</u><script>x</script></p>" }, "CNTT");
  assert.equal(saved.body, "<p><u>riêng</u></p>");
  assert.equal((await ReminderTemplateService.getEffective()).body, "<p>chung</p>");
  await ReminderTemplateService.reset("CNTT");
  await ReminderTemplateService.reset();
});

test("chữ ký: mặc định tắt/rỗng; lưu, đọc lại, làm sạch HTML, từ chối bật khi rỗng và biến lạ", async () => {
  await run("UPDATE reminder_settings SET signature_enabled = FALSE, signature_html = NULL WHERE id = 'default'");
  const initial = await ReminderSignatureService.getView();
  assert.equal(initial.enabled, false);
  assert.equal(initial.html, "");
  assert.ok(initial.sampleHtml.includes("Chữ ký mẫu"));

  await assert.rejects(() => ReminderSignatureService.save({ enabled: true }), /nhập nội dung chữ ký/);
  await assert.rejects(() => ReminderSignatureService.save({ html: "<p>{sai}</p>" }), TemplateValidationError);
  await assert.rejects(() => ReminderSignatureService.save({ enabled: "yes" }), TemplateValidationError);
  await assert.rejects(() => ReminderSignatureService.save({ html: 123 }), TemplateValidationError);
  await assert.rejects(() => ReminderSignatureService.save({ html: `<p>${"a".repeat(2001)}</p>` }), /tối đa 2000/);

  const saved = await ReminderSignatureService.save({
    enabled: true,
    html: '<p>VNPT <script>x</script><a href="tel:123" onclick="x()">gọi</a> <a href="mailto:a@b.vn">mail</a></p>',
  });
  assert.equal(saved.enabled, true);
  assert.ok(!/script|onclick|tel:/i.test(saved.html));
  assert.ok(saved.html.includes('href="mailto:a@b.vn"'));

  // Chỉ đổi công tắc thì giữ nội dung; chỉ đổi nội dung thì giữ công tắc.
  const off = await ReminderSignatureService.save({ enabled: false });
  assert.equal(off.enabled, false);
  assert.equal(off.html, saved.html);
  const edited = await ReminderSignatureService.save({ html: "<p>Mới</p>" });
  assert.equal(edited.enabled, false);
  assert.equal(edited.html, "<p>Mới</p>");

  // Xoá hết nội dung (đang tắt) được phép.
  const cleared = await ReminderSignatureService.save({ enabled: false, html: "<p></p>" });
  assert.equal(cleared.html, "");
});

test("preview/gửi thử kèm chữ ký đã lưu hoặc bản nháp chữ ký", async () => {
  await ReminderTemplateService.reset();
  await ReminderSignatureService.save({ enabled: true, html: "<p>Chữ ký lưu</p>" });
  const stored = await ReminderTemplateService.preview({ subject: "s", body: "<p>Nội dung</p>" });
  assert.ok(stored.html.includes("Chữ ký lưu"));
  assert.ok(stored.text.endsWith("--\nChữ ký lưu"));

  const draft = await ReminderTemplateService.preview({
    subject: "s",
    body: "<p>Nội dung</p>",
    signature: { enabled: true, html: "<p>Nháp {AM phụ trách}</p>" },
  });
  assert.ok(draft.html.includes("Nháp Nguyễn Văn A"));
  assert.ok(!draft.html.includes("Chữ ký lưu"));

  const off = await ReminderTemplateService.preview({ subject: "s", body: "x", signature: { enabled: false } });
  assert.ok(!off.html.includes("Chữ ký lưu"));
  await assert.rejects(
    () => ReminderTemplateService.preview({ subject: "s", body: "x", signature: { html: "<p>{sai}</p>" } }),
    TemplateValidationError
  );
  await assert.rejects(() => ReminderTemplateService.preview({ signature: "x" }), TemplateValidationError);

  const calls: { html?: string; text: string }[] = [];
  const fakeSend = async (msg: { to: string | string[]; subject: string; text: string; html?: string }) => {
    calls.push(msg);
    return { sent: true };
  };
  await ReminderTemplateService.sendTest("a@b.co", { subject: "s", body: "<p>Hi</p>" }, fakeSend);
  assert.ok(calls[0].html?.includes("Chữ ký lưu"));
  assert.ok(calls[0].text.includes("Chữ ký lưu"));
  await ReminderSignatureService.save({ enabled: false, html: "" });
});

test("runner gửi email HTML + text kèm chữ ký cho mọi người nhận (nhân viên, CC)", async () => {
  await run("DELETE FROM reminder_logs WHERE item_id LIKE 'SVC-RICH-%'");
  await run("DELETE FROM services WHERE id LIKE 'SVC-RICH-%'");
  await run("DELETE FROM staff WHERE id LIKE 'STAFF-RICH-%'");
  const suffix = `${Date.now()}`;
  await run(`INSERT INTO staff (id, code, name, role, status, email) VALUES (?, ?, ?, ?, ?, ?)`, [
    `STAFF-RICH-${suffix}`,
    `CODE-RICH-${suffix}`,
    `AM Rich ${suffix}`,
    "AM",
    "Đang hoạt động",
    "am-rich@example.com",
  ]);
  await run(
    `INSERT INTO services (id, customer_name, service_name, service_code, start_date, expiration_date, staff_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [`SVC-RICH-${suffix}`, "KH Rich", `DV-RICH-${suffix}`, "SUB-RICH", "2026-01-01", "2026-11-18", `AM Rich ${suffix}`]
  );
  await ReminderSettingsService.update({ notifyStaff: true, notifyCustomer: false, daysBefore: [7], extraCc: "cc-rich@example.com" });
  await ReminderTemplateService.save({
    subject: "RICH {dịch vụ}",
    body: '<p><strong>Gửi</strong> <span style="color:#ff0000">{tên khách}</span></p>',
  });
  await ReminderSignatureService.save({ enabled: true, html: "<p>Trân trọng,<br>VNPT NSG</p>" });

  const sent: { to: string | string[]; subject: string; text: string; html?: string }[] = [];
  const fakeSend = async (msg: { to: string | string[]; subject: string; text: string; html?: string }) => {
    sent.push(msg);
    return { sent: true };
  };
  await ReminderRunner.run("2026-11-11", { send: fakeSend });
  const mine = sent.filter((m) => m.subject.includes(`DV-RICH-${suffix}`));
  assert.equal(mine.length, 1);
  assert.deepEqual(mine[0].to, ["am-rich@example.com", "cc-rich@example.com"]);
  assert.ok(mine[0].html?.includes("<strong>Gửi</strong>"));
  assert.ok(mine[0].html?.includes("Trân trọng,<br>VNPT NSG"));
  assert.equal(mine[0].text, "Gửi KH Rich\n\n--\nTrân trọng,\nVNPT NSG");

  // Tắt chữ ký: lần chạy sau (mốc khác, dịch vụ khác ngày) không còn chữ ký.
  await ReminderSignatureService.save({ enabled: false });
  await run("DELETE FROM reminder_logs WHERE item_id LIKE 'SVC-RICH-%'");
  sent.length = 0;
  await ReminderRunner.run("2026-11-11", { send: fakeSend });
  const again = sent.filter((m) => m.subject.includes(`DV-RICH-${suffix}`));
  assert.equal(again.length, 1);
  assert.ok(!again[0].text.includes("VNPT NSG"));
  assert.ok(!again[0].html?.includes("VNPT NSG"));

  await ReminderTemplateService.reset();
  await ReminderSignatureService.save({ enabled: false, html: "" });
});
