import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyContractRows,
  AM_REQUIRED_IMPORT_MESSAGE,
  CUSTOMER_AMBIGUOUS_MESSAGE,
  CUSTOMER_NOT_FOUND_MESSAGE,
  type ExistingContract,
  type ImportCustomer,
} from "./classify.js";
import { ITEMS_REQUIRED_MESSAGE, type ContractItemInput } from "../contract-items.js";
import type { ContractImportRow } from "./parse.js";

const DEFAULT_ITEMS: ContractItemInput[] = [
  {
    lineType: "service",
    serviceGroup: null,
    serviceName: null,
    packageName: null,
    subscriberCode: "0901234567",
    quantity: 1,
    unitPrice: 100000,
    termMonths: null,
    startDate: null,
    note: null,
  },
];

function makeRow(overrides: Partial<ContractImportRow> = {}): ContractImportRow {
  const rowNumber = overrides.rowNumber ?? 2;
  return {
    rowNumber,
    rowNumbers: [rowNumber],
    transactionCode: "",
    customerName: "",
    subscriberCodes: [],
    totalValue: null,
    termMonths: null,
    channel: "",
    amStaff: "AM Import",
    serviceGroup: "",
    serviceName: "",
    packageName: "",
    taxCode: "",
    contractNumber: "",
    signedDate: "",
    note: "",
    items: DEFAULT_ITEMS,
    ...overrides,
  };
}

function makeExisting(overrides: Partial<ExistingContract> = {}): ExistingContract {
  return {
    id: "HD-1",
    transaction_code: "GD-001",
    customer_name: "Khách cũ",
    subscriber_codes: "[]",
    total_value: 0,
    channel: "Online",
    am_staff: null,
    service_group: null,
    service_name: null,
    package_name: null,
    tax_code: null,
    contract_number: null,
    signed_date: null,
    customer_id: null,
    ...overrides,
  };
}

const CUSTOMERS: ImportCustomer[] = [
  { id: "C-1", name: "Công Ty ABC", identity_code: "0301234567" },
  { id: "C-2", name: "Công Ty XYZ", identity_code: null },
];

test("classifies row as new when transaction_code not found in DB", () => {
  const row = makeRow({ rowNumber: 2, transactionCode: "GD-NEW", customerName: "Công Ty ABC" });
  const [classified] = classifyContractRows([row], [], CUSTOMERS);

  assert.equal(classified.status, "new");
  assert.equal(classified.customer?.id, "C-1");
  assert.equal(classified.existing, undefined);
});

test("classifies row as update when transaction_code matches existing contract", () => {
  const existing = makeExisting({ transaction_code: "GD-001" });
  const row = makeRow({ rowNumber: 2, transactionCode: "GD-001", customerName: "Công Ty ABC" });
  const [classified] = classifyContractRows([row], [existing], CUSTOMERS);

  assert.equal(classified.status, "update");
  assert.equal(classified.existing?.id, "HD-1");
});

test("notes in-file duplicate transaction codes without blocking classification", () => {
  const rowA = makeRow({ rowNumber: 2, transactionCode: "GD-DUP", customerName: "Công Ty ABC" });
  const rowB = makeRow({ rowNumber: 3, transactionCode: "GD-DUP", customerName: "Công Ty XYZ" });

  const [classifiedA, classifiedB] = classifyContractRows([rowA, rowB], [], CUSTOMERS);

  assert.equal(classifiedA.notes.length, 0);
  assert.equal(classifiedB.notes.length, 1);
  assert.match(classifiedB.notes[0], /Trùng mã giao dịch với dòng 2/);
  assert.equal(classifiedA.status, "new");
  assert.equal(classifiedB.status, "new");
});

test("new row matches customer by tax code before name", () => {
  const row = makeRow({
    transactionCode: "GD-MST",
    customerName: "Công Ty XYZ",
    taxCode: "301234567",
  });
  const [classified] = classifyContractRows([row], [], CUSTOMERS);

  assert.equal(classified.status, "new");
  assert.equal(classified.customer?.id, "C-1");
});

test("new row falls back to case-insensitive exact customer name", () => {
  const row = makeRow({ transactionCode: "GD-NAME", customerName: "  công ty xyz " });
  const [classified] = classifyContractRows([row], [], CUSTOMERS);

  assert.equal(classified.status, "new");
  assert.equal(classified.customer?.id, "C-2");
});

test("new row without a matching customer is an error", () => {
  const row = makeRow({ transactionCode: "GD-NOPE", customerName: "Công Ty Lạ", taxCode: "0999999999" });
  const [classified] = classifyContractRows([row], [], CUSTOMERS);

  assert.equal(classified.status, "error");
  assert.equal(classified.customer, undefined);
  assert.equal(classified.notes[0], CUSTOMER_NOT_FOUND_MESSAGE);
});

test("new row matching several customers by name is an ambiguity error", () => {
  const customers = [...CUSTOMERS, { id: "C-3", name: "CÔNG TY ABC", identity_code: null }];
  const row = makeRow({ transactionCode: "GD-AMB", customerName: "công ty abc" });
  const [classified] = classifyContractRows([row], [], customers);

  assert.equal(classified.status, "error");
  assert.equal(classified.notes[0], CUSTOMER_AMBIGUOUS_MESSAGE);
});

test("update row keeps existing customer when no customer matches", () => {
  const existing = makeExisting({ transaction_code: "GD-001", customer_id: "C-1" });
  const row = makeRow({ transactionCode: "GD-001", customerName: "Tên không có trong hệ thống" });
  const [classified] = classifyContractRows([row], [existing], CUSTOMERS);

  assert.equal(classified.status, "update");
  assert.equal(classified.customer, undefined);
});

test("update row without matching customer is an error when the contract has no customer", () => {
  const existing = makeExisting({ transaction_code: "GD-001", customer_id: null });
  const row = makeRow({ transactionCode: "GD-001", customerName: "Tên không có trong hệ thống" });
  const [classified] = classifyContractRows([row], [existing], CUSTOMERS);

  assert.equal(classified.status, "error");
  assert.equal(classified.notes[0], CUSTOMER_NOT_FOUND_MESSAGE);
});

test("update row assigns the matched customer to a contract without customer", () => {
  const existing = makeExisting({ transaction_code: "GD-001", customer_id: null });
  const row = makeRow({ transactionCode: "GD-001", customerName: "Công Ty ABC" });
  const [classified] = classifyContractRows([row], [existing], CUSTOMERS);

  assert.equal(classified.status, "update");
  assert.equal(classified.customer?.id, "C-1");
});

test("new row without an AM is an error", () => {
  const row = makeRow({ transactionCode: "GD-NOAM", customerName: "Công Ty ABC", amStaff: "  " });
  const [classified] = classifyContractRows([row], [], CUSTOMERS);

  assert.equal(classified.status, "error");
  assert.equal(classified.notes[0], AM_REQUIRED_IMPORT_MESSAGE);
});

test("update row without an AM is fine only when the contract already has one", () => {
  const withAm = makeExisting({ transaction_code: "GD-001", customer_id: "C-1", am_staff: "AM Cũ" });
  const withoutAm = makeExisting({ id: "HD-2", transaction_code: "GD-002", customer_id: "C-1", am_staff: null });
  const rows = [
    makeRow({ rowNumber: 2, transactionCode: "GD-001", customerName: "Công Ty ABC", amStaff: "" }),
    makeRow({ rowNumber: 3, transactionCode: "GD-002", customerName: "Công Ty ABC", amStaff: "" }),
    makeRow({ rowNumber: 4, transactionCode: "GD-002", customerName: "Công Ty ABC", amStaff: "AM Mới" }),
  ];
  const [keep, missing, filled] = classifyContractRows(rows, [withAm, withoutAm], CUSTOMERS);

  assert.equal(keep.status, "update");
  assert.equal(missing.status, "error");
  assert.equal(missing.notes[0], AM_REQUIRED_IMPORT_MESSAGE);
  assert.equal(filled.status, "update");
});

// T9 (STT 10/11): mỗi đơn mới phải có >= 1 dòng dịch vụ/thiết bị.
test("new row without any service/device item is an error", () => {
  const row = makeRow({ transactionCode: "GD-NOITEM", customerName: "Công Ty ABC", items: [] });
  const [classified] = classifyContractRows([row], [], CUSTOMERS);

  assert.equal(classified.status, "error");
  assert.equal(classified.notes[0], ITEMS_REQUIRED_MESSAGE);
});

test("update row without any item in the file keeps existing contract_items untouched (no items error)", () => {
  const existing = makeExisting({ transaction_code: "GD-001", customer_id: "C-1" });
  const row = makeRow({ transactionCode: "GD-001", customerName: "Công Ty ABC", items: [] });
  const [classified] = classifyContractRows([row], [existing], CUSTOMERS);

  assert.equal(classified.status, "update");
});

test("new row with an invalid item (service line without subscriber code) is an error", () => {
  const row = makeRow({
    transactionCode: "GD-BADITEM",
    customerName: "Công Ty ABC",
    items: [{ ...DEFAULT_ITEMS[0], subscriberCode: "" }],
  });
  const [classified] = classifyContractRows([row], [], CUSTOMERS);

  assert.equal(classified.status, "error");
  assert.match(classified.notes[0], /mã thuê bao/);
});
