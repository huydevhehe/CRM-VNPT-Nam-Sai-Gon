import { expect, test, type APIRequestContext } from "@playwright/test";
import { ADMIN, AM, API_URL, apiLogin, bearer } from "./helpers";

const AM_NAME = "Nguyễn Thị Tình";
const BLOCK_MESSAGE = "Không thể quay lại bước trước. Hãy gửi yêu cầu để Admin duyệt.";

test.describe("Lead: chặn lùi bước, yêu cầu duyệt, sửa thông tin, chi tiết kênh", () => {
  let adminToken: string;
  let amToken: string;
  const suffix = Date.now();
  const createdSources: string[] = [];

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    amToken = await apiLogin(request, AM.username, AM.password);
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdSources) {
      await request.delete(`${API_URL}/channel-sources/${id}`, { headers: bearer(adminToken) });
    }
  });

  function postLead(request: APIRequestContext, extra: Record<string, unknown> = {}) {
    return request.post(`${API_URL}/leads`, {
      headers: bearer(adminToken),
      data: {
        customerName: `KH Quy trình ${suffix}`,
        phone: "0901234567",
        group: "Lead KH mới",
        channel: "Chiến dịch",
        staffName: AM_NAME,
        ...extra,
      },
    });
  }

  async function newLead(request: APIRequestContext, extra: Record<string, unknown> = {}): Promise<string> {
    const res = await postLead(request, extra);
    expect(res.status(), await res.text()).toBe(201);
    return (await res.json()).data.id;
  }

  test("API Lead mới: 401 khi chưa đăng nhập, 403 khi AM gọi route Admin", async ({ request }) => {
    for (const [method, path] of [
      ["patch", "/leads/LEAD-X"],
      ["post", "/leads/LEAD-X/stage-requests"],
      ["get", "/leads/stage-requests"],
      ["patch", "/leads/stage-requests/X"],
      ["get", "/channel-sources"],
      ["post", "/channel-sources"],
    ] as const) {
      const res = await request[method](`${API_URL}${path}`, { data: {} });
      expect(res.status(), `${method} ${path}`).toBe(401);
    }

    const amHeaders = { headers: bearer(amToken) };
    const id = await newLead(request);
    expect((await request.patch(`${API_URL}/leads/${id}`, { ...amHeaders, data: { customerName: "x" } })).status()).toBe(403);
    expect((await request.get(`${API_URL}/leads/stage-requests`, amHeaders)).status()).toBe(403);
    expect((await request.patch(`${API_URL}/leads/stage-requests/X`, { ...amHeaders, data: { action: "approve" } })).status()).toBe(403);
    expect((await request.post(`${API_URL}/channel-sources`, { ...amHeaders, data: { kind: "partner", name: "x" } })).status()).toBe(403);
    expect((await request.delete(`${API_URL}/channel-sources/CHS-SEED-1`, amHeaders)).status()).toBe(403);
  });

  test("nhân viên lùi bước bị 409; Admin đổi tự do; yêu cầu duyệt chạy đủ vòng đời", async ({ request }) => {
    const id = await newLead(request);
    const am = { headers: bearer(amToken) };
    const admin = { headers: bearer(adminToken) };

    expect((await request.patch(`${API_URL}/leads/${id}/status`, { ...am, data: { status: "Đang tư vấn" } })).status()).toBe(200);
    const back = await request.patch(`${API_URL}/leads/${id}/status`, { ...am, data: { status: "Đã liên hệ" } });
    expect(back.status()).toBe(409);
    expect((await back.json()).message).toBe(BLOCK_MESSAGE);

    // Xin duyệt: thiếu lý do 400, hợp lệ 201, trùng 409
    expect((await request.post(`${API_URL}/leads/${id}/stage-requests`, { ...am, data: { toStatus: "Đã liên hệ", reason: "" } })).status()).toBe(400);
    const created = await request.post(`${API_URL}/leads/${id}/stage-requests`, {
      ...am,
      data: { toStatus: "Đã liên hệ", reason: "Nhập nhầm trạng thái" },
    });
    expect(created.status()).toBe(201);
    const reqId = (await created.json()).data.id;
    expect((await request.post(`${API_URL}/leads/${id}/stage-requests`, { ...am, data: { toStatus: "Mới tiếp nhận", reason: "lại" } })).status()).toBe(409);

    // Nhân viên không duyệt được; Admin duyệt thì trạng thái đổi
    expect((await request.patch(`${API_URL}/leads/stage-requests/${reqId}`, { ...am, data: { action: "approve" } })).status()).toBe(403);
    const list = await request.get(`${API_URL}/leads/stage-requests?status=${encodeURIComponent("Chờ duyệt")}`, admin);
    expect((await list.json()).data.some((r: { id: string }) => r.id === reqId)).toBe(true);
    const approved = await request.patch(`${API_URL}/leads/stage-requests/${reqId}`, { ...admin, data: { action: "approve", note: "OK" } });
    expect(approved.status()).toBe(200);
    expect((await approved.json()).data.status).toBe("Đã duyệt");
    const after = (await (await request.get(`${API_URL}/leads`, admin)).json()).data.find((l: { id: string }) => l.id === id);
    expect(after.status).toBe("Đã liên hệ");
    expect((await request.patch(`${API_URL}/leads/stage-requests/${reqId}`, { ...admin, data: { action: "reject" } })).status()).toBe(409);

    // Admin đổi lùi trực tiếp
    expect((await request.patch(`${API_URL}/leads/${id}/status`, { ...admin, data: { status: "Mới tiếp nhận" } })).status()).toBe(200);
  });

  test("Admin sửa thông tin Lead và chi tiết kênh theo từng kênh", async ({ request }) => {
    const admin = { headers: bearer(adminToken) };
    const online = await request.post(`${API_URL}/channel-sources`, { ...admin, data: { kind: "online", name: `Website E2E ${suffix}` } });
    expect(online.status()).toBe(201);
    const onlineId = (await online.json()).data.id;
    const partner = await request.post(`${API_URL}/channel-sources`, { ...admin, data: { kind: "partner", name: `Đối tác E2E ${suffix}` } });
    expect(partner.status()).toBe(201);
    const partnerId = (await partner.json()).data.id;
    createdSources.push(onlineId, partnerId);

    // Ràng buộc khi tạo
    expect((await postLead(request, { channel: "Online" })).status()).toBe(400);
    expect((await postLead(request, { channel: "Online", channelSourceId: partnerId })).status()).toBe(400);
    expect((await postLead(request, { channel: "Đối tác" })).status()).toBe(400);
    expect((await postLead(request, { channel: "CTV giới thiệu" })).status()).toBe(400);

    const id = await newLead(request, { channel: "Online", channelSourceId: onlineId });
    const patched = await request.patch(`${API_URL}/leads/${id}`, {
      ...admin,
      data: { customerName: `KH Đã Sửa ${suffix}`, phone: "0988111222", channel: "Đối tác", channelSourceId: partnerId },
    });
    expect(patched.status(), await patched.text()).toBe(200);
    const body = (await patched.json()).data;
    expect(body.customerName).toBe(`KH Đã Sửa ${suffix}`);
    expect(body.channel).toBe("Đối tác");
    expect(body.channelSourceName).toBe(`Đối tác E2E ${suffix}`);

    // Nguồn đã dùng: xóa chỉ ẩn
    const del = await request.delete(`${API_URL}/channel-sources/${partnerId}`, admin);
    expect(del.status()).toBe(200);
    const delBody = await del.json();
    expect(delBody.data.deactivated).toBe(true);
    const activeList = await (await request.get(`${API_URL}/channel-sources?kind=partner`, { headers: bearer(amToken) })).json();
    expect(activeList.data.some((s: { id: string }) => s.id === partnerId)).toBe(false);
  });
});
