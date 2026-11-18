import test from "node:test";
import assert from "node:assert/strict";
import { canAccessAdminPath, isAdminOnlyPath } from "./access";

test("nhận diện các trang chỉ Admin, kể cả đường dẫn con", () => {
  for (const path of [
    "/admin/commissions",
    "/admin/kpi-settings",
    "/admin/reminders",
    "/admin/ctv-accounts",
    "/admin/employees",
    "/admin/settings",
    "/admin/system-settings",
    "/admin/system-settings/smtp",
    "/admin/channel-sources",
  ]) {
    assert.equal(isAdminOnlyPath(path), true, path);
  }
});

test("trang dùng chung không bị coi là chỉ Admin (không khớp theo tiền tố chuỗi)", () => {
  for (const path of ["/admin/dashboard", "/admin/leads", "/admin/customers", "/admin/settings-other", "/admin/tasks"]) {
    assert.equal(isAdminOnlyPath(path), false, path);
  }
});

test("AM bị chặn trang chỉ Admin, Admin vào được tất cả", () => {
  assert.equal(canAccessAdminPath("AM", "/admin/commissions"), false);
  assert.equal(canAccessAdminPath("AM Bán chăm", "/admin/employees"), false);
  assert.equal(canAccessAdminPath("AM", "/admin/leads"), true);
  assert.equal(canAccessAdminPath("Admin", "/admin/commissions"), true);
});
