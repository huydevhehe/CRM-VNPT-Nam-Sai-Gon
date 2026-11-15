import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";

import { parseContractSheet, readWorkbookRows } from "./parse.js";

test("parses Vietnamese contract import headers", () => {
  const { rows, errors } = parseContractSheet([
    {
      "Mã giao dịch": "GD-001",
      "Tên khách hàng": "Công ty TNHH ABC",
      "Mã thuê bao": "0901234567, 0909876543",
      "Giá trị đơn hàng": "1.500.000",
      Kênh: "Online",
      "AM phụ trách": "Nguyễn Văn A",
      "Nhóm dịch vụ": "BRCĐ",
      "Tên dịch vụ": "FiberVNN",
      "Gói cước": "Home Net 2",
      MST: 317424086,
      "Số hợp đồng": "HD-2026-001",
      "Ngày ký": "2026-11-10",
      "Ghi chú": "Khách VIP",
    },
  ]);

  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.transactionCode, "GD-001");
  assert.equal(row.customerName, "Công ty TNHH ABC");
  assert.deepEqual(row.subscriberCodes, ["0901234567", "0909876543"]);
  assert.equal(row.totalValue, 1500000);
  assert.equal(row.channel, "Online");
  assert.equal(row.amStaff, "Nguyễn Văn A");
  assert.equal(row.serviceGroup, "BRCĐ");
  assert.equal(row.serviceName, "FiberVNN");
  assert.equal(row.packageName, "Home Net 2");
  assert.equal(row.taxCode, "0317424086");
  assert.equal(row.contractNumber, "HD-2026-001");
  assert.equal(row.signedDate, "2026-11-10");
  assert.equal(row.note, "Khách VIP");
});

test("splits subscriber codes on newline too", () => {
  const { rows } = parseContractSheet([
    {
      "Mã giao dịch": "GD-002",
      "Tên khách hàng": "Khách B",
      "Mã thuê bao": "0901111111\n0902222222",
    },
  ]);

  assert.deepEqual(rows[0].subscriberCodes, ["0901111111", "0902222222"]);
});

test("reports missing transaction code and customer name, skips empty rows", () => {
  const { rows, errors } = parseContractSheet([
    { "Mã giao dịch": "", "Tên khách hàng": "Khách thiếu mã" },
    { "Mã giao dịch": "GD-003", "Tên khách hàng": "" },
    { "Mã giao dịch": "", "Tên khách hàng": "" },
    { "Mã giao dịch": "GD-004", "Tên khách hàng": "Khách hợp lệ" },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].transactionCode, "GD-004");
  assert.equal(errors.length, 2);
  assert.equal(errors[0].message, "Thiếu mã giao dịch");
  assert.equal(errors[1].message, "Thiếu tên khách hàng");
});

test("readWorkbookRows reads a plain contract sheet", () => {
  const aoa = [
    ["Mã giao dịch", "Tên khách hàng", "Giá trị đơn hàng"],
    ["GD-005", "Công ty XYZ", 2000000],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Hợp đồng");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const rawRows = readWorkbookRows(buffer);
  const { rows, errors } = parseContractSheet(rawRows);

  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].transactionCode, "GD-005");
  assert.equal(rows[0].customerName, "Công ty XYZ");
  assert.equal(rows[0].totalValue, 2000000);
});
