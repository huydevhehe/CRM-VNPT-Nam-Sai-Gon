import { expect, test } from "@playwright/test";
import { ADMIN, AM, API_URL, apiLogin, bearer } from "./helpers";

const GROUP_URL = (group: string, suffix = "") => `${API_URL}/reminders/template${suffix}?group=${encodeURIComponent(group)}`;

test.describe("API Mẫu email nhắc hết hạn theo nhóm dịch vụ", () => {
  test.describe.configure({ mode: "serial" });

  let adminToken: string;
  let amToken: string;

  async function resetAll(request: Parameters<Parameters<typeof test.beforeAll>[0]>[0]["request"]) {
    for (const group of ["BRCĐ", "CNTT", "Di động"]) {
      await request.post(GROUP_URL(group, "/reset"), { headers: bearer(adminToken) });
    }
    await request.post(`${API_URL}/reminders/template/reset`, { headers: bearer(adminToken) });
  }

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    amToken = await apiLogin(request, AM.username, AM.password);
    await resetAll(request);
  });

  test.afterAll(async ({ request }) => {
    await resetAll(request);
  });

  test("nhóm chưa có mẫu riêng thì theo mẫu chung", async ({ request }) => {
    await request.put(`${API_URL}/reminders/template`, {
      headers: bearer(adminToken),
      data: { subject: "CHUNG {dịch vụ}", body: "Mẫu chung" },
    });
    const res = await request.get(GROUP_URL("CNTT"), { headers: bearer(adminToken) });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(data.group).toBe("CNTT");
    expect(data.isDefault).toBe(true);
    expect(data.subject).toBe("CHUNG {dịch vụ}");
    expect(data.defaultSubject).toBe("CHUNG {dịch vụ}");
  });

  test("lưu mẫu riêng cho nhóm không đổi mẫu chung và nhóm khác", async ({ request }) => {
    const put = await request.put(GROUP_URL("CNTT"), {
      headers: bearer(adminToken),
      data: { subject: "CNTT {dịch vụ}", body: "Riêng CNTT cho {tên khách}" },
    });
    expect(put.status()).toBe(200);
    expect((await put.json()).data.isDefault).toBe(false);

    const general = await (await request.get(`${API_URL}/reminders/template`, { headers: bearer(adminToken) })).json();
    expect(general.data.subject).toBe("CHUNG {dịch vụ}");
    const brcd = await (await request.get(GROUP_URL("BRCĐ"), { headers: bearer(adminToken) })).json();
    expect(brcd.data.subject).toBe("CHUNG {dịch vụ}");
    const cntt = await (await request.get(GROUP_URL("CNTT"), { headers: bearer(adminToken) })).json();
    expect(cntt.data.body).toBe("Riêng CNTT cho {tên khách}");
  });

  test("xem trước theo nhóm dùng mẫu riêng của nhóm", async ({ request }) => {
    const res = await request.post(GROUP_URL("CNTT", "/preview"), { headers: bearer(adminToken), data: {} });
    expect(res.status()).toBe(200);
    expect((await res.json()).data.subject).toBe("CNTT Internet cáp quang FiberVNN");
  });

  test("nhóm không hợp lệ -> 400; mẫu riêng sai biến -> 400 và không ghi đè", async ({ request }) => {
    const bad = await request.get(GROUP_URL("Khác"), { headers: bearer(adminToken) });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).message).toContain("Nhóm dịch vụ không hợp lệ");

    const unknown = await request.put(GROUP_URL("CNTT"), {
      headers: bearer(adminToken),
      data: { subject: "{sai}", body: "x" },
    });
    expect(unknown.status()).toBe(400);
    const still = await (await request.get(GROUP_URL("CNTT"), { headers: bearer(adminToken) })).json();
    expect(still.data.subject).toBe("CNTT {dịch vụ}");
  });

  test("reset nhóm xoá mẫu riêng, nhóm theo lại mẫu chung", async ({ request }) => {
    const res = await request.post(GROUP_URL("CNTT", "/reset"), { headers: bearer(adminToken) });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(data.isDefault).toBe(true);
    expect(data.subject).toBe("CHUNG {dịch vụ}");
  });

  test("AM gọi route mẫu theo nhóm -> 403", async ({ request }) => {
    const headers = bearer(amToken);
    expect((await request.get(GROUP_URL("CNTT"), { headers })).status()).toBe(403);
    expect((await request.put(GROUP_URL("CNTT"), { headers, data: { subject: "a", body: "b" } })).status()).toBe(403);
    expect((await request.post(GROUP_URL("CNTT", "/reset"), { headers })).status()).toBe(403);
  });
});
