import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyServiceRows,
  CUSTOMER_AMBIGUOUS_MESSAGE,
  CUSTOMER_NOT_FOUND_MESSAGE,
  type ExistingService,
  type ImportCustomer,
} from "./classify.js";
import type { ServiceImportRow } from "./parse.js";

const TODAY = "2026-11-16";
const STAFF = ["Nguyễn Văn A", "Trần Thị B"];

function makeRow(overrides: Partial<ServiceImportRow> = {}): ServiceImportRow {
  return {
    rowNumber: 2,
    customerCode: "",
    taxCode: "",
    customerName: "",
    serviceCode: "SUB-1",
    serviceName: "FiberVNN",
    serviceGroup: "",
    packageName: "",
    paymentType: "",
    startDate: "",
    endDate: "",
    termMonths: null,
    amStaff: "",
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<ImportCustomer> = {}): ImportCustomer {
  return {
    id: "C-1",
    name: "Công ty ABC",
    identity_code: "0317424086",
    customer_code: "KH001",
    am_staff: null,
    am_caring_staff: null,
    ...overrides,
  };
}

function makeExisting(overrides: Partial<ExistingService> = {}): ExistingService {
  return {
    id: "SRV-1",
    customer_id: "C-1",
    customer_name: "Công ty ABC",
    service_code: "SUB-1",
    service_name: "Dịch vụ cũ",
    service_group: "BRCĐ",
    package_name: "Gói cũ",
    payment_type: "Trả trước",
    start_date: "2025-01-01",
    expiration_date: "2026-01-01",
    staff_name: "Trần Thị B",
    contract_id: null,
    contract_transaction_code: null,
    ...overrides,
  };
}

function classify(rows: ServiceImportRow[], existing: ExistingService[] = [], customers = [makeCustomer()]) {
  return classifyServiceRows(rows, existing, customers, STAFF, TODAY);
}

test("matches the customer by customer code first, then tax code, then exact name", () => {
  const customers = [
    makeCustomer({ id: "C-1", name: "Công ty ABC", identity_code: "0317424086", customer_code: "KH001" }),
    makeCustomer({ id: "C-2", name: "Công ty XYZ", identity_code: "0400000000", customer_code: "KH002" }),
  ];
  const [byCode, byTax, byName, codeWins] = classify(
    [
      makeRow({ rowNumber: 2, customerCode: "kh001", serviceCode: "S1" }),
      makeRow({ rowNumber: 3, taxCode: "400000000", serviceCode: "S2" }),
      makeRow({ rowNumber: 4, customerName: "CÔNG TY ABC", serviceCode: "S3" }),
      makeRow({ rowNumber: 5, customerCode: "KH002", taxCode: "0317424086", customerName: "Công ty ABC", serviceCode: "S4" }),
    ],
    [],
    customers
  );

  assert.equal(byCode.customer?.id, "C-1");
  assert.equal(byTax.customer?.id, "C-2");
  assert.equal(byName.customer?.id, "C-1");
  assert.equal(codeWins.customer?.id, "C-2");
  assert.deepEqual([byCode.status, byTax.status, byName.status], ["new", "new", "new"]);
});

test("reports not found and ambiguous customers as row errors", () => {
  const customers = [
    makeCustomer({ id: "C-1", name: "Công ty Trùng", identity_code: null, customer_code: "A" }),
    makeCustomer({ id: "C-2", name: "công ty trùng", identity_code: null, customer_code: "B" }),
  ];
  const [notFound, ambiguous] = classify(
    [
      makeRow({ rowNumber: 2, customerName: "Công ty Không Có" }),
      makeRow({ rowNumber: 3, customerName: "Công ty Trùng" }),
    ],
    [],
    customers
  );

  assert.equal(notFound.status, "error");
  assert.deepEqual(notFound.notes, [CUSTOMER_NOT_FOUND_MESSAGE]);
  assert.equal(ambiguous.status, "error");
  assert.deepEqual(ambiguous.notes, [CUSTOMER_AMBIGUOUS_MESSAGE]);
});

test("new vs update by (customer, subscriber code); update keeps blank columns' existing values", () => {
  const [created, updated] = classify(
    [
      makeRow({ rowNumber: 2, customerCode: "KH001", serviceCode: "SUB-NEW", serviceGroup: "CNTT" }),
      makeRow({ rowNumber: 3, customerCode: "KH001", serviceCode: "SUB-1", serviceName: "Tên mới" }),
    ],
    [makeExisting()]
  );

  assert.equal(created.status, "new");
  assert.equal(created.existing, undefined);
  assert.equal(created.resolved?.serviceGroup, "CNTT");
  assert.equal(updated.status, "update");
  assert.equal(updated.existing?.id, "SRV-1");
  assert.equal(updated.resolved?.serviceGroup, "BRCĐ");
  assert.equal(updated.resolved?.startDate, "2025-01-01");
  assert.equal(updated.resolved?.expirationDate, "2026-01-01");
  assert.equal(updated.resolved?.staffName, "Trần Thị B");
});

test("a subscriber code generated from an order is an error naming the order", () => {
  const [item] = classify(
    [makeRow({ customerCode: "KH001", serviceCode: "SUB-1" })],
    [makeExisting({ contract_id: "HD-1", contract_transaction_code: "GD-777" })]
  );

  assert.equal(item.status, "error");
  assert.deepEqual(item.notes, ["Mã thuê bao thuộc đơn hàng GD-777, vui lòng chỉnh ở đơn hàng"]);
});

test("validates group, payment type, AM and dates", () => {
  const base = { customerCode: "KH001" };
  const items = classify([
    makeRow({ ...base, rowNumber: 2, serviceGroup: "Khác" }),
    makeRow({ ...base, rowNumber: 3, paymentType: "Trả sau" }),
    makeRow({ ...base, rowNumber: 4, amStaff: "Người lạ" }),
    makeRow({ ...base, rowNumber: 5, startDate: "32/13/2026" }),
    makeRow({ ...base, rowNumber: 6, startDate: "2026-05-01", endDate: "2026-04-01" }),
    makeRow({ ...base, rowNumber: 7, serviceGroup: "di dong", paymentType: "trả hàng tháng", amStaff: "nguyễn văn a" }),
  ]);

  assert.deepEqual(
    items.map((i) => i.status),
    ["error", "error", "error", "error", "error", "new"]
  );
  assert.match(items[0].notes[0], /Nhóm dịch vụ không hợp lệ/);
  assert.match(items[1].notes[0], /Hình thức thanh toán không hợp lệ/);
  assert.match(items[2].notes[0], /AM phụ trách "Người lạ" không tồn tại/);
  assert.match(items[3].notes[0], /Ngày bắt đầu không hợp lệ/);
  assert.equal(items[4].notes[0], "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
  assert.equal(items[5].resolved?.serviceGroup, "Di động");
  assert.equal(items[5].resolved?.paymentType, "Trả hàng tháng");
  assert.equal(items[5].resolved?.staffName, "Nguyễn Văn A");
});

test("resolves dates for new rows: today, term months and default 12 months", () => {
  const [none, withStart, withTerm, withEnd, pastEnd] = classify([
    makeRow({ rowNumber: 2, customerCode: "KH001", serviceCode: "A" }),
    makeRow({ rowNumber: 3, customerCode: "KH001", serviceCode: "B", startDate: "2026-01-31" }),
    makeRow({ rowNumber: 4, customerCode: "KH001", serviceCode: "C", startDate: "2026-01-31", termMonths: 1 }),
    makeRow({ rowNumber: 5, customerCode: "KH001", serviceCode: "D", endDate: "2027-05-01" }),
    makeRow({ rowNumber: 6, customerCode: "KH001", serviceCode: "E", endDate: "2026-02-01" }),
  ]);

  assert.deepEqual([none.resolved?.startDate, none.resolved?.expirationDate], [TODAY, "2027-11-16"]);
  assert.deepEqual([withStart.resolved?.startDate, withStart.resolved?.expirationDate], ["2026-01-31", "2027-01-31"]);
  assert.deepEqual([withTerm.resolved?.startDate, withTerm.resolved?.expirationDate], ["2026-01-31", "2026-02-28"]);
  assert.deepEqual([withEnd.resolved?.startDate, withEnd.resolved?.expirationDate], [TODAY, "2027-05-01"]);
  assert.deepEqual([pastEnd.resolved?.startDate, pastEnd.resolved?.expirationDate], ["2026-02-01", "2026-02-01"]);
});

test("staff defaults: file AM, then sales AM, then caring AM", () => {
  const customers = [
    makeCustomer({ id: "C-1", customer_code: "KH001", am_staff: "Nguyễn Văn A", am_caring_staff: "Trần Thị B" }),
    makeCustomer({ id: "C-2", name: "Khác", identity_code: null, customer_code: "KH002", am_caring_staff: "Trần Thị B" }),
  ];
  const [fromFile, sales, caring] = classify(
    [
      makeRow({ rowNumber: 2, customerCode: "KH001", serviceCode: "A", amStaff: "Trần Thị B" }),
      makeRow({ rowNumber: 3, customerCode: "KH001", serviceCode: "B" }),
      makeRow({ rowNumber: 4, customerCode: "KH002", serviceCode: "C" }),
    ],
    [],
    customers
  );

  assert.equal(fromFile.resolved?.staffName, "Trần Thị B");
  assert.equal(sales.resolved?.staffName, "Nguyễn Văn A");
  assert.equal(caring.resolved?.staffName, "Trần Thị B");
});

test("warns (without blocking) about duplicate customer + code rows in the same file, later row wins", () => {
  const [first, second, other] = classify([
    makeRow({ rowNumber: 2, customerCode: "KH001", serviceCode: "DUP" }),
    makeRow({ rowNumber: 3, customerCode: "KH001", serviceCode: "DUP" }),
    makeRow({ rowNumber: 4, customerCode: "KH001", serviceCode: "OTHER" }),
  ]);

  assert.equal(first.status, "new");
  assert.equal(second.status, "new");
  assert.match(first.notes.join(";"), /dòng 3.*dòng sau được ưu tiên/);
  assert.match(second.notes.join(";"), /dòng 2.*dòng này được ưu tiên/);
  assert.deepEqual(other.notes, []);
});

test("notes when the subscriber code already belongs to another customer", () => {
  const [item] = classify(
    [makeRow({ customerCode: "KH001", serviceCode: "SUB-1" })],
    [makeExisting({ customer_id: "C-9", customer_name: "Khách khác" })]
  );

  assert.equal(item.status, "new");
  assert.deepEqual(item.notes, ["Mã thuê bao này đang gắn với khách hàng khác: Khách khác"]);
});

test("update with dates only partly in the file", () => {
  const existing = [makeExisting()];
  const [onlyStart, onlyEnd, onlyTerm] = classify(
    [
      makeRow({ rowNumber: 2, customerCode: "KH001", startDate: "2026-06-01" }),
      makeRow({ rowNumber: 3, customerCode: "KH001", endDate: "2028-01-01" }),
      makeRow({ rowNumber: 4, customerCode: "KH001", termMonths: 6 }),
    ],
    existing
  );

  assert.deepEqual([onlyStart.resolved?.startDate, onlyStart.resolved?.expirationDate], ["2026-06-01", "2027-06-01"]);
  assert.deepEqual([onlyEnd.resolved?.startDate, onlyEnd.resolved?.expirationDate], ["2025-01-01", "2028-01-01"]);
  assert.deepEqual([onlyTerm.resolved?.startDate, onlyTerm.resolved?.expirationDate], ["2025-01-01", "2025-07-01"]);
});
