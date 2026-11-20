import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";

import { groupContractImportLines, parseContractSheet, readWorkbookRows } from "./parse.js";

function parseAndGroup(rawRows: Record<string, unknown>[]) {
  const { lines, errors } = parseContractSheet(rawRows);
  return { rows: groupContractImportLines(lines), errors };
}

test("parses Vietnamese contract import headers (kiểu cũ: 1 dòng, nhiều mã thuê bao)", () => {
  const { rows, errors } = parseAndGroup([
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
  assert.deepEqual(row.subscriberCodes.sort(), ["0901234567", "0909876543"]);
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
  // Kiểu cũ: chia đều tổng tiền cho 2 mã, tổng 2 dòng = 1.500.000.
  assert.equal(row.items.length, 2);
  const sum = row.items.reduce((s, it) => s + Number(it.unitPrice), 0);
  assert.equal(sum, 1500000);
});

test("splits subscriber codes on newline too", () => {
  const { rows } = parseAndGroup([
    {
      "Mã giao dịch": "GD-002",
      "Tên khách hàng": "Khách B",
      "Mã thuê bao": "0901111111\n0902222222",
    },
  ]);

  assert.deepEqual(rows[0].subscriberCodes.sort(), ["0901111111", "0902222222"]);
});

test("reports missing transaction code and customer name, skips empty rows", () => {
  const { rows, errors } = parseAndGroup([
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
  const { rows, errors } = parseAndGroup(rawRows);

  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].transactionCode, "GD-005");
  assert.equal(rows[0].customerName, "Công ty XYZ");
  assert.equal(rows[0].totalValue, 2000000);
  // Không có "Mã thuê bao"/"Đơn giá"/"Loại dòng" -> không góp dòng dịch vụ nào (chỉ sửa thông tin chung).
  assert.equal(rows[0].items.length, 0);
});

test("parses the term months column by its Vietnamese aliases", () => {
  const base = { "Mã giao dịch": "GD-T", "Tên khách hàng": "Khách T" };
  const { rows } = parseAndGroup([
    { ...base, "Thời hạn (tháng)": 24 },
    { ...base, "Mã giao dịch": "GD-T2", "Thời hạn (tháng)": "" },
    { ...base, "Mã giao dịch": "GD-T3", "Thời hạn (tháng)": "abc" },
  ]);
  assert.equal(rows[0].termMonths, 24);
  assert.equal(rows[1].termMonths, null);
  assert.equal(rows[2].termMonths, null);

  const alias = parseAndGroup([{ ...base, "thoi han thang": "12" }]);
  assert.equal(alias.rows[0].termMonths, 12);
  const alias2 = parseAndGroup([{ ...base, "Thời hạn": "6" }]);
  assert.equal(alias2.rows[0].termMonths, 6);
});

test("STT 10/11 (T9): nhiều dòng Excel cùng Mã giao dịch gộp thành 1 đơn nhiều dịch vụ + 1 thiết bị", () => {
  const { rows, errors } = parseAndGroup([
    {
      "Mã giao dịch": "GD-MULTI",
      "Tên khách hàng": "Công ty Nhiều Dịch Vụ",
      "Loại dòng": "Dịch vụ",
      "Mã thuê bao": "0911111111",
      "Nhóm dịch vụ": "BRCĐ",
      "Tên dịch vụ": "FiberVNN",
      "Gói cước": "Home Net 2",
      "Đơn giá": "300000",
      Kênh: "Online",
      "AM phụ trách": "Nguyễn Văn A",
    },
    {
      "Mã giao dịch": "GD-MULTI",
      "Tên khách hàng": "Công ty Nhiều Dịch Vụ",
      "Loại dòng": "Dịch vụ",
      "Mã thuê bao": "0922222222",
      "Nhóm dịch vụ": "CNTT",
      "Tên dịch vụ": "VNPT CA",
      "Gói cước": "Gói 1 năm",
      "Đơn giá": "500000",
    },
    {
      "Mã giao dịch": "GD-MULTI",
      "Tên khách hàng": "Công ty Nhiều Dịch Vụ",
      "Loại dòng": "Thiết bị",
      "Tên dịch vụ": "TOKEN",
      "Số lượng": 1,
      "Đơn giá": "162000",
    },
  ]);

  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.rowNumbers.length, 3);
  assert.equal(row.items.length, 3);
  assert.equal(row.items.filter((i) => i.lineType === "service").length, 2);
  assert.equal(row.items.filter((i) => i.lineType === "device").length, 1);
  assert.equal(row.totalValue, 300000 + 500000 + 162000);
  assert.equal(row.channel, "Online");
  assert.equal(row.amStaff, "Nguyễn Văn A");
});
