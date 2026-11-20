import { expect, test, type APIRequestContext } from "@playwright/test";
import { ADMIN, AM, API_URL, apiLogin, bearer } from "./helpers";

const GROUP_SETTING_URL = (group: string) => `${API_URL}/reminders/groups/${encodeURIComponent(group)}`;

test.describe("API Nhắc hết hạn: HTML, chữ ký, số ngày theo nhóm", () => {
  test.describe.configure({ mode: "serial" });

  let adminToken: string;
  let amToken: string;
  let generalDays: number[] = [30, 7, 1];

  async function cleanup(request: APIRequestContext) {
    for (const group of ["BRCĐ", "CNTT", "Di động"]) {
      await request.delete(GROUP_SETTING_URL(group), { headers: bearer(adminToken) });
    }
    await request.put(`${API_URL}/reminders/signature`, { headers: bearer(adminToken), data: { enabled: false, html: "" } });
    await request.post(`${API_URL}/reminders/template/reset`, { headers: bearer(adminToken) });
  }

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    amToken = await apiLogin(request, AM.username, AM.password);
    generalDays = (await (await request.get(`${API_URL}/reminders/settings`, { headers: bearer(adminToken) })).json()).data
      .daysBefore;
    await cleanup(request);
  });

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("lưu mẫu HTML: định dạng an toàn được giữ, script/onerror/javascript: bị loại", async ({ request }) => {
    const put = await request.put(`${API_URL}/reminders/template`, {
      headers: bearer(adminToken),
      data: {
        subject: "Nhắc {dịch vụ}",
        body:
          '<p><strong>Kính gửi</strong> <span style="color:#ff0000">{tên khách}</span></p>' +
          '<script>alert(1)</script><img src=x onerror="alert(2)">' +
          '<p><a href="javascript:alert(3)">xấu</a> <a href="https://vnpt.vn">tốt</a></p>',
      },
    });
    expect(put.status()).toBe(200);
    const { data } = await put.json();
    expect(data.body).toContain("<strong>Kính gửi</strong>");
    expect(data.body).toContain('<span style="color: #ff0000">{tên khách}</span>');
    expect(data.body).toContain('href="https://vnpt.vn"');
    expect(data.body).not.toMatch(/script|onerror|javascript:|<img/i);

    const get = await request.get(`${API_URL}/reminders/template`, { headers: bearer(adminToken) });
    expect((await get.json()).data.body).toBe(data.body);
  });

  test("biến bị chen thẻ định dạng vẫn thay thế; biến lạ trong đoạn định dạng -> 400", async ({ request }) => {
    const ok = await request.post(`${API_URL}/reminders/template/preview`, {
      headers: bearer(adminToken),
      data: { subject: "s", body: "<p>Chào {tên <b>khách</b>}</p>" },
    });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).data.text).toBe("Chào Công ty TNHH ABC");

    const bad = await request.put(`${API_URL}/reminders/template`, {
      headers: bearer(adminToken),
      data: { subject: "s", body: "<p><b>{biến_lạ}</b></p>" },
    });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).message).toContain("{biến_lạ}");
  });

  test("chữ ký: mặc định tắt; lưu/đọc lại; làm sạch; bật khi rỗng -> 400", async ({ request }) => {
    const initial = (await (await request.get(`${API_URL}/reminders/signature`, { headers: bearer(adminToken) })).json()).data;
    expect(initial.enabled).toBe(false);
    expect(initial.html).toBe("");
    expect(initial.sampleHtml).toContain("Chữ ký mẫu");

    const empty = await request.put(`${API_URL}/reminders/signature`, { headers: bearer(adminToken), data: { enabled: true } });
    expect(empty.status()).toBe(400);
    expect((await empty.json()).message).toContain("chữ ký");

    const put = await request.put(`${API_URL}/reminders/signature`, {
      headers: bearer(adminToken),
      data: { enabled: true, html: '<p>VNPT NSG<script>x</script><br>ĐT: <b>028 1234 5678</b></p>' },
    });
    expect(put.status()).toBe(200);
    const saved = (await put.json()).data;
    expect(saved.enabled).toBe(true);
    expect(saved.html).toBe("<p>VNPT NSG<br>ĐT: <b>028 1234 5678</b></p>");

    const invalid = await request.put(`${API_URL}/reminders/signature`, {
      headers: bearer(adminToken),
      data: { html: "<p>{biến_lạ}</p>" },
    });
    expect(invalid.status()).toBe(400);
  });

  test("xem trước kèm chữ ký đã lưu, và bản nháp chữ ký ghi đè", async ({ request }) => {
    const stored = await request.post(`${API_URL}/reminders/template/preview`, {
      headers: bearer(adminToken),
      data: { subject: "s", body: "<p>Nội dung</p>" },
    });
    const storedData = (await stored.json()).data;
    expect(storedData.html).toContain("VNPT NSG");
    expect(storedData.text).toBe("Nội dung\n\n--\nVNPT NSG\nĐT: 028 1234 5678");

    const off = await request.post(`${API_URL}/reminders/template/preview`, {
      headers: bearer(adminToken),
      data: { subject: "s", body: "<p>Nội dung</p>", signature: { enabled: false } },
    });
    expect((await off.json()).data.html).not.toContain("VNPT NSG");

    const draft = await request.post(`${API_URL}/reminders/template/preview`, {
      headers: bearer(adminToken),
      data: { subject: "s", body: "<p>Nội dung</p>", signature: { enabled: true, html: "<p>Nháp</p>" } },
    });
    const draftData = (await draft.json()).data;
    expect(draftData.html).toContain("Nháp");
    expect(draftData.html).not.toContain("VNPT NSG");
  });

  test("số ngày theo nhóm: mặc định theo chung; đặt riêng, chuẩn hoá; dùng lại chung", async ({ request }) => {
    const initial = (await (await request.get(`${API_URL}/reminders/groups`, { headers: bearer(adminToken) })).json()).data;
    expect(initial.general).toEqual(generalDays);
    expect(initial.groups.map((g: { group: string }) => g.group)).toEqual(["BRCĐ", "CNTT", "Di động"]);
    for (const g of initial.groups) {
      expect(g.custom).toBe(false);
      expect(g.enabled).toBe(true);
      expect(g.daysBefore).toEqual(generalDays);
    }

    const put = await request.put(GROUP_SETTING_URL("CNTT"), {
      headers: bearer(adminToken),
      data: { daysBefore: [15, 60, 7, 60] },
    });
    expect(put.status()).toBe(200);
    expect((await put.json()).data).toMatchObject({ group: "CNTT", custom: true, enabled: true, daysBefore: [60, 15, 7] });

    const after = (await (await request.get(`${API_URL}/reminders/groups`, { headers: bearer(adminToken) })).json()).data;
    expect(after.groups.find((g: { group: string }) => g.group === "BRCĐ").custom).toBe(false);
    expect(after.groups.find((g: { group: string }) => g.group === "CNTT").daysBefore).toEqual([60, 15, 7]);

    const off = await request.put(GROUP_SETTING_URL("Di động"), { headers: bearer(adminToken), data: { enabled: false } });
    expect((await off.json()).data).toMatchObject({ custom: true, enabled: false, daysBefore: generalDays });

    const reset = await request.delete(GROUP_SETTING_URL("CNTT"), { headers: bearer(adminToken) });
    expect(reset.status()).toBe(200);
    expect((await reset.json()).data).toMatchObject({ custom: false, daysBefore: generalDays });
  });

  test("số ngày theo nhóm: dữ liệu sai -> 400, không ghi gì", async ({ request }) => {
    const headers = bearer(adminToken);
    const cases: { group: string; data: unknown }[] = [
      { group: "Khác", data: { daysBefore: [3] } },
      { group: "CNTT", data: { daysBefore: [] } },
      { group: "CNTT", data: { daysBefore: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] } },
      { group: "CNTT", data: { daysBefore: [-1] } },
      { group: "CNTT", data: { daysBefore: [2.5] } },
      { group: "CNTT", data: { daysBefore: "7" } },
      { group: "CNTT", data: { enabled: "yes" } },
    ];
    for (const { group, data } of cases) {
      const res = await request.put(GROUP_SETTING_URL(group), { headers, data: data as Record<string, unknown> });
      expect(res.status(), JSON.stringify(data)).toBe(400);
    }
    const cntt = (await (await request.get(`${API_URL}/reminders/groups`, { headers })).json()).data.groups.find(
      (g: { group: string }) => g.group === "CNTT"
    );
    expect(cntt.custom).toBe(false);
  });

  test("AM và người chưa đăng nhập không dùng được chữ ký/nhóm: 403 / 401", async ({ request }) => {
    const headers = bearer(amToken);
    expect((await request.get(`${API_URL}/reminders/signature`, { headers })).status()).toBe(403);
    expect((await request.put(`${API_URL}/reminders/signature`, { headers, data: { enabled: false } })).status()).toBe(403);
    expect((await request.get(`${API_URL}/reminders/groups`, { headers })).status()).toBe(403);
    expect((await request.put(GROUP_SETTING_URL("CNTT"), { headers, data: { daysBefore: [3] } })).status()).toBe(403);
    expect((await request.delete(GROUP_SETTING_URL("CNTT"), { headers })).status()).toBe(403);

    expect((await request.get(`${API_URL}/reminders/signature`)).status()).toBe(401);
    expect((await request.get(`${API_URL}/reminders/groups`)).status()).toBe(401);
    expect((await request.put(GROUP_SETTING_URL("CNTT"), { data: { daysBefore: [3] } })).status()).toBe(401);
    expect((await request.delete(GROUP_SETTING_URL("CNTT"))).status()).toBe(401);
  });
});
