import test from "node:test";
import assert from "node:assert/strict";
import {
  formatMoney,
  formatNumberVi,
  groupDigits,
  normalizeMoneyDigits,
  parseMoneyInput,
} from "./money";

test("groupDigits separates thousands with a dot", () => {
  assert.equal(groupDigits(""), "");
  assert.equal(groupDigits("5"), "5");
  assert.equal(groupDigits("999"), "999");
  assert.equal(groupDigits("1000"), "1.000");
  assert.equal(groupDigits("5940000"), "5.940.000");
  assert.equal(groupDigits("1234567890"), "1.234.567.890");
});

test("normalizeMoneyDigits keeps digits only, drops leading zeros and caps length", () => {
  assert.equal(normalizeMoneyDigits("5.940.000"), "5940000");
  assert.equal(normalizeMoneyDigits("5,940,000 ₫"), "5940000");
  assert.equal(normalizeMoneyDigits("abc"), "");
  assert.equal(normalizeMoneyDigits("000"), "0");
  assert.equal(normalizeMoneyDigits("007"), "7");
  assert.equal(normalizeMoneyDigits("1".repeat(20)).length, 13);
});

test("formatNumberVi / formatMoney use dot grouping and the ₫ sign", () => {
  assert.equal(formatNumberVi(0), "0");
  assert.equal(formatNumberVi(1234567), "1.234.567");
  assert.equal(formatNumberVi(-2500000), "-2.500.000");
  assert.equal(formatNumberVi("1500000"), "1.500.000");
  assert.equal(formatNumberVi(12.6), "13");
  assert.equal(formatNumberVi(null), "0");
  assert.equal(formatNumberVi(undefined), "0");
  assert.equal(formatNumberVi("abc"), "0");
  assert.equal(formatMoney(1234567), "1.234.567 ₫");
});

test("parseMoneyInput returns an integer for the API or null when empty", () => {
  assert.equal(parseMoneyInput("5.940.000"), 5940000);
  assert.equal(parseMoneyInput("5940000"), 5940000);
  assert.equal(parseMoneyInput(""), null);
  assert.equal(parseMoneyInput("đ"), null);
});
