import { test } from "node:test";
import assert from "node:assert/strict";
import { REMINDER_TEMPLATE_GROUPS, normalizeDaysInput, reminderTemplatePath } from "./reminders.api";

test("mẫu chung không có query group", () => {
  assert.equal(reminderTemplatePath(""), "/reminders/template");
  assert.equal(reminderTemplatePath("/preview", null), "/reminders/template/preview");
});

test("mẫu nhóm mã hoá tên nhóm có dấu trong query", () => {
  assert.equal(reminderTemplatePath("", "BRCĐ"), "/reminders/template?group=BRC%C4%90");
  assert.equal(reminderTemplatePath("/reset", "Di động"), "/reminders/template/reset?group=Di%20%C4%91%E1%BB%99ng");
});

test("danh sách nhóm khớp nhóm dịch vụ của hệ thống", () => {
  assert.deepEqual([...REMINDER_TEMPLATE_GROUPS], ["BRCĐ", "CNTT", "Di động"]);
});

test("normalizeDaysInput bỏ trùng và sắp giảm dần", () => {
  assert.deepEqual(normalizeDaysInput([1, 30, 7, 7, 60]), [60, 30, 7, 1]);
  assert.deepEqual(normalizeDaysInput([]), []);
});
