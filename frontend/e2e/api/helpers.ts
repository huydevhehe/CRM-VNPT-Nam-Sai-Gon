import { expect, type APIRequestContext } from "@playwright/test";

export const API_URL = process.env.E2E_API_URL || "http://localhost:8099/api";

export const ADMIN = { username: "admin", password: "admin@Vnpt2026" };
export const AM = { username: "VNPT-AM-01", password: "VNPT-AM-01@Vnpt2026" };

/** Đăng nhập qua API thật và trả về JWT; ném lỗi nếu không phải 200. */
export async function apiLogin(
  request: APIRequestContext,
  username: string,
  password: string
): Promise<string> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { username, password },
  });
  expect(res.status(), `Đăng nhập ${username} phải trả 200`).toBe(200);
  const body = await res.json();
  const token = body?.data?.token;
  if (typeof token !== "string" || !token) {
    throw new Error(`Đăng nhập ${username} không trả về token`);
  }
  return token;
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export interface RegisterCtvPayload {
  username: string;
  password: string;
  name: string;
  phone: string;
  email?: string;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Số điện thoại 10 số hợp lệ (0 + 9 chữ số), đủ ngẫu nhiên để không trùng giữa các lần chạy. */
export function uniquePhone(): string {
  const digits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9).padStart(9, "0");
  return `0${digits}`;
}

/** IP giả ngẫu nhiên (server tin X-Forwarded-For) để mỗi lần đăng ký không chạm giới hạn chung của một IP. */
export function randomIp(): string {
  const n = () => Math.floor(Math.random() * 254) + 1;
  return `198.${n()}.${n()}.${n()}`;
}

/** Đăng ký CTV qua API thật với dữ liệu mặc định duy nhất; trả response thô để test tự kiểm tra status. */
export async function registerCtv(
  request: APIRequestContext,
  overrides: Partial<RegisterCtvPayload> = {},
  ip: string = randomIp()
) {
  const payload: RegisterCtvPayload = {
    username: `ctv_${Date.now()}_${randomSuffix()}`,
    password: "Ctv@12345",
    name: "CTV E2E Test",
    phone: uniquePhone(),
    ...overrides,
  };
  const res = await request.post(`${API_URL}/auth/register-ctv`, {
    data: payload,
    headers: { "X-Forwarded-For": ip },
  });
  return { res, payload };
}

/** Đăng ký CTV mới, Admin duyệt, đăng nhập và trả về thông tin + token. */
export async function createApprovedCtv(
  request: APIRequestContext,
  adminToken: string
): Promise<{ id: string; username: string; password: string; token: string; referralCode: string }> {
  const { res, payload } = await registerCtv(request);
  expect(res.status(), "Đăng ký CTV phải trả 201").toBe(201);

  const listRes = await request.get(
    `${API_URL}/ctv-accounts?status=${encodeURIComponent("Chờ duyệt")}`,
    { headers: bearer(adminToken) }
  );
  expect(listRes.status()).toBe(200);
  const accounts: Array<{ id: string; username: string; referralCode: string }> = (
    await listRes.json()
  ).data;
  const account = accounts.find((a) => a.username === payload.username);
  if (!account) {
    throw new Error(`Không tìm thấy CTV ${payload.username} trong danh sách chờ duyệt`);
  }

  const approveRes = await request.patch(`${API_URL}/ctv-accounts/${account.id}/approve`, {
    headers: bearer(adminToken),
  });
  expect(approveRes.status(), "Admin duyệt CTV phải trả 200").toBe(200);

  const token = await apiLogin(request, payload.username, payload.password);
  return {
    id: account.id,
    username: payload.username,
    password: payload.password,
    token,
    referralCode: account.referralCode,
  };
}

let cachedDefaultAmName: string | null = null;

/**
 * Tên AM dùng làm "AM phát triển" mặc định khi tạo đơn qua API (AM phát triển là bắt buộc).
 * Ưu tiên AM đăng nhập mẫu (VNPT-AM-01), nếu không có thì lấy AM đầu tiên trong danh sách nhân viên.
 */
export async function getDefaultAmName(
  request: APIRequestContext,
  adminToken: string
): Promise<string> {
  if (cachedDefaultAmName) return cachedDefaultAmName;
  const res = await request.get(`${API_URL}/staff`, { headers: bearer(adminToken) });
  expect(res.status(), "Lấy danh sách nhân viên phải trả 200").toBe(200);
  const list = (await res.json()).data as { code: string; name: string; role: string }[];
  const am = list.find((s) => s.code === AM.username) ?? list.find((s) => s.role === "AM");
  if (!am) throw new Error("Không có AM nào trong dữ liệu để làm AM phát triển mặc định");
  cachedDefaultAmName = am.name;
  return am.name;
}

export interface TestCustomer {
  id: string;
  name: string;
  identityCode: string | null;
}

/**
 * Tạo khách hàng qua API thật để gắn vào đơn hàng (Đơn hàng bắt buộc có khách hàng).
 * Mặc định AM phụ trách là AM đăng nhập mẫu (VNPT-AM-01) để cả Admin lẫn AM đều chọn được.
 */
export async function createCustomerForOrder(
  request: APIRequestContext,
  token: string,
  overrides: { name?: string; identityCode?: string; amStaff?: string; amCaringStaff?: string } = {}
): Promise<TestCustomer> {
  const name = overrides.name ?? `KH Đơn hàng ${Date.now()}-${randomSuffix()}`;
  const res = await request.post(`${API_URL}/customers`, {
    headers: bearer(token),
    data: {
      name,
      type: "Doanh nghiệp",
      customerGroup: "Tự phát triển",
      identityCode: overrides.identityCode,
      amStaff: overrides.amStaff,
      amCaringStaff: overrides.amCaringStaff,
    },
  });
  expect(res.status(), "Tạo khách hàng cho đơn hàng phải trả 201").toBe(201);
  const data = (await res.json()).data;
  return { id: data.id, name: data.name, identityCode: data.identity_code ?? null };
}
