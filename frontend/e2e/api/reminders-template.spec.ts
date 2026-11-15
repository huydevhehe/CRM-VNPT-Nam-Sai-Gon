import { expect, test } from "@playwright/test";
import { ADMIN, AM, API_URL, apiLogin, bearer } from "./helpers";

test.describe("API Mẫu email nhắc hết hạn", () => {
  test.describe.configure({ mode: "serial" });

  let adminToken: string;
  let amToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    amToken = await apiLogin(request, AM.username, AM.password);
    await request.post(`${API_URL}/reminders/template/reset`, { headers: bearer(adminToken) });
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${API_URL}/reminders/template/reset`, { headers: bearer(adminToken) });
  });

  test("Admin lấy mẫu: mặc định + danh sách biến", async ({ request }) => {
    const res = await request.get(`${API_URL}/reminders/template`, { headers: bearer(adminToken) });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(data.isDefault).toBe(true);
    expect(data.subject).toBe(data.defaultSubject);
    expect(data.body).toBe(data.defaultBody);
    const keys = data.variables.map((v: { key: string }) => v.key);
    expect(keys).toEqual(
      expect.arrayContaining(["tên khách", "dịch vụ", "ngày hết hạn", "số ngày còn lại", "mã thuê bao", "AM phụ trách"])
    );
  });

  test("Lưu mẫu hợp lệ rồi lấy lại đúng nội dung", async ({ request }) => {
    const put = await request.put(`${API_URL}/reminders/template`, {
      headers: bearer(adminToken),
      data: { subject: "Nhắc {dịch vụ} của {tên khách}", body: "Kính gửi {tên khách},\nHết hạn {ngày hết hạn}." },
    });
    expect(put.status()).toBe(200);
    expect((await put.json()).data.isDefault).toBe(false);

    const get = await request.get(`${API_URL}/reminders/template`, { headers: bearer(adminToken) });
    const { data } = await get.json();
    expect(data.subject).toBe("Nhắc {dịch vụ} của {tên khách}");
    expect(data.body).toBe("Kính gửi {tên khách},\nHết hạn {ngày hết hạn}.");
    expect(data.isDefault).toBe(false);
  });

  test("Lưu mẫu không hợp lệ -> 400 và không ghi đè mẫu cũ", async ({ request }) => {
    const unknown = await request.put(`${API_URL}/reminders/template`, {
      headers: bearer(adminToken),
      data: { subject: "Tiêu đề {biến_lạ}", body: "Nội dung {sai_nữa} {tên khách}" },
    });
    expect(unknown.status()).toBe(400);
    const msg = (await unknown.json()).message as string;
    expect(msg).toContain("{biến_lạ}");
    expect(msg).toContain("{sai_nữa}");

    const empty = await request.put(`${API_URL}/reminders/template`, {
      headers: bearer(adminToken),
      data: { subject: "  ", body: "" },
    });
    expect(empty.status()).toBe(400);

    const tooLong = await request.put(`${API_URL}/reminders/template`, {
      headers: bearer(adminToken),
      data: { subject: "a".repeat(201), body: "b".repeat(5001) },
    });
    expect(tooLong.status()).toBe(400);

    const get = await request.get(`${API_URL}/reminders/template`, { headers: bearer(adminToken) });
    expect((await get.json()).data.subject).toBe("Nhắc {dịch vụ} của {tên khách}");
  });

  test("Xem trước mẫu đang soạn: thay biến, escape HTML, không lưu", async ({ request }) => {
    const res = await request.post(`${API_URL}/reminders/template/preview`, {
      headers: bearer(adminToken),
      data: { subject: "Thử {tên khách}", body: "<script>x</script>\n{số ngày còn lại} ngày" },
    });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(data.subject).toBe("Thử Công ty TNHH ABC");
    expect(data.html).not.toContain("<script>");
    expect(data.html).toContain("&lt;script&gt;x&lt;/script&gt;<br>7 ngày");
    expect(data.text).toContain("<script>x</script>");

    const saved = await request.post(`${API_URL}/reminders/template/preview`, {
      headers: bearer(adminToken),
      data: {},
    });
    expect((await saved.json()).data.subject).toBe("Nhắc Internet cáp quang FiberVNN của Công ty TNHH ABC");

    const bad = await request.post(`${API_URL}/reminders/template/preview`, {
      headers: bearer(adminToken),
      data: { subject: "{lạ}", body: "x" },
    });
    expect(bad.status()).toBe(400);
  });

  test("Gửi thử với email không hợp lệ -> 400", async ({ request }) => {
    const res = await request.post(`${API_URL}/reminders/template/test`, {
      headers: bearer(adminToken),
      data: { to: "khong-phai-email" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("không hợp lệ");
  });

  test("Khôi phục mặc định", async ({ request }) => {
    const res = await request.post(`${API_URL}/reminders/template/reset`, { headers: bearer(adminToken) });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(data.isDefault).toBe(true);
    expect(data.subject).toBe(data.defaultSubject);
    expect(data.body).toBe(data.defaultBody);
  });

  test("AM gọi mọi route mẫu email -> 403", async ({ request }) => {
    const headers = bearer(amToken);
    expect((await request.get(`${API_URL}/reminders/template`, { headers })).status()).toBe(403);
    expect(
      (await request.put(`${API_URL}/reminders/template`, { headers, data: { subject: "a", body: "b" } })).status()
    ).toBe(403);
    expect((await request.post(`${API_URL}/reminders/template/preview`, { headers, data: {} })).status()).toBe(403);
    expect((await request.post(`${API_URL}/reminders/template/reset`, { headers })).status()).toBe(403);
    expect(
      (await request.post(`${API_URL}/reminders/template/test`, { headers, data: { to: "a@b.co" } })).status()
    ).toBe(403);
  });
});
