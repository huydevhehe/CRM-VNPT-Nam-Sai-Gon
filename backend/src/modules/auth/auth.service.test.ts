import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

const { initDatabase, run, query } = await import("../../database/db.js");
const { AuthService, HttpError } = await import("./auth.service.js");

await initDatabase();

const service = new AuthService();

async function createUser(password: string): Promise<string> {
  const id = `USR-PW-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const hash = await bcrypt.hash(password, 4);
  await run(
    "INSERT INTO users (id, username, password_hash, name, role, status, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, id.toLowerCase(), hash, "Người đổi mật khẩu", "AM", "Đang hoạt động", true]
  );
  return id;
}

async function expectHttpError(promise: Promise<unknown>, status: number, message: string) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof HttpError, "phải là HttpError");
    assert.equal(err.status, status);
    assert.equal(err.message, message);
    return true;
  });
}

test("changePassword: sai mật khẩu hiện tại trả 400 (không phải 401) và không đổi gì", async () => {
  const id = await createUser("Cu@12345678");
  await expectHttpError(service.changePassword(id, "sai-mat-khau", "Moi@12345678"), 400, "Mật khẩu hiện tại không đúng");
  const rows = await query<{ password_hash: string; must_change_password: boolean }>(
    "SELECT password_hash, must_change_password FROM users WHERE id = ?",
    [id]
  );
  assert.equal(await bcrypt.compare("Cu@12345678", rows[0].password_hash), true);
  assert.equal(rows[0].must_change_password, true);
});

test("changePassword: mật khẩu mới ngắn, quá dài hoặc trùng mật khẩu cũ bị từ chối", async () => {
  const id = await createUser("Cu@12345678");
  await expectHttpError(service.changePassword(id, "Cu@12345678", "1234567"), 400, "Mật khẩu mới phải có ít nhất 8 ký tự");
  await expectHttpError(service.changePassword(id, "Cu@12345678", "a".repeat(73)), 400, "Mật khẩu mới tối đa 72 ký tự");
  await expectHttpError(
    service.changePassword(id, "Cu@12345678", "Cu@12345678"),
    400,
    "Mật khẩu mới phải khác mật khẩu hiện tại"
  );
});

test("changePassword: đổi thành công thì mật khẩu mới dùng được, mật khẩu cũ hết hiệu lực, cờ bắt đổi mật khẩu tắt", async () => {
  const id = await createUser("Cu@12345678");
  await service.changePassword(id, "Cu@12345678", "Moi@12345678");
  const rows = await query<{ username: string; password_hash: string; must_change_password: boolean }>(
    "SELECT username, password_hash, must_change_password FROM users WHERE id = ?",
    [id]
  );
  assert.equal(await bcrypt.compare("Moi@12345678", rows[0].password_hash), true);
  assert.equal(await bcrypt.compare("Cu@12345678", rows[0].password_hash), false);
  assert.equal(rows[0].must_change_password, false);

  const login = await service.login(rows[0].username, "Moi@12345678");
  assert.equal(login.user.mustChangePassword, false);
});

test("changePassword: người dùng không tồn tại trả 404", async () => {
  await expectHttpError(service.changePassword("USR-KHONG-CO", "a", "Moi@12345678"), 404, "Không tìm thấy người dùng");
});
