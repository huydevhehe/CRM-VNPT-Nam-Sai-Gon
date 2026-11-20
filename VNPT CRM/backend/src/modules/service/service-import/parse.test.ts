import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";

import { parseServiceSheet, readWorkbookRows } from "./parse.js";

test("parses Vietnamese service import headers (accented and unaccented)", () => {
  const { rows, errors } = parseServiceSheet([
    {
      "Mã khách hàng": "KH001",
      "MST/CCCD": 317424086,
      "Tên khách hàng": "Công ty TNHH ABC",
      "Mã thuê bao": "0901234567",
      "Tên dịch vụ": "FiberVNN",
      "Nhóm dịch vụ": "BRCĐ",
      "Gói cước": "Home Net 2",
      "Hình thức thanh toán": "Trả trước",
      "Ngày bắt đầu": "2026-01-15",
      "Ngày kết thúc": "2027-01-14",
      "Thời hạn (tháng)": 12,
      "AM phụ trách": "Nguyễn Văn A",
    },
  ]);
  const snake = parseServiceSheet([
    {
      ma_khach_hang: "KH002",
      mst: "0101234567-001",
      ten_khach_hang: "Công ty B",
      ma_thue_bao: "SUB-2",
      ten_dich_vu: "Mega",
    },
  ]);

  assert.equal(errors.length, 0);
  assert.equal(snake.errors.length, 0);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    { ...rows[0], rowNumber: 0 },
    {
      rowNumber: 0,
      customerCode: "KH001",
      taxCode: "0317424086",
      customerName: "Công ty TNHH ABC",
      serviceCode: "0901234567",
      serviceName: "FiberVNN",
      serviceGroup: "BRCĐ",
      packageName: "Home Net 2",
      paymentType: "Trả trước",
      startDate: "2026-01-15",
      endDate: "2027-01-14",
      termMonths: 12,
      amStaff: "Nguyễn Văn A",
    }
  );
  const second = snake.rows[0];
  assert.equal(second.customerCode, "KH002");
  assert.equal(second.taxCode, "0101234567-001");
  assert.equal(second.serviceCode, "SUB-2");
  assert.equal(second.serviceName, "Mega");
  assert.equal(second.termMonths, null);
});

test("normalizes the three date formats: YYYY-MM-DD, DD/MM/YYYY and Excel serial", () => {
  const { rows, errors } = parseServiceSheet([
    { "Mã thuê bao": "A", "Tên dịch vụ": "S", "Ngày bắt đầu": "2026-03-05", "Ngày kết thúc": "31/12/2026" },
    { "Mã thuê bao": "B", "Tên dịch vụ": "S", "Ngày bắt đầu": 46027, "Ngày kết thúc": "46300" },
    { "Mã thuê bao": "C", "Tên dịch vụ": "S", "Ngày bắt đầu": "không phải ngày" },
  ]);

  assert.equal(errors.length, 0);
  assert.equal(rows[0].startDate, "2026-03-05");
  assert.equal(rows[0].endDate, "2026-12-31");
  assert.equal(rows[1].startDate, "2026-01-05");
  assert.equal(rows[1].endDate, "2026-10-05");
  assert.equal(rows[2].startDate, "không phải ngày");
  assert.equal(rows[2].endDate, "");
});

test("reports rows missing the required subscriber code or service name", () => {
  const { rows, errors } = parseServiceSheet([
    { "Mã thuê bao": "", "Tên dịch vụ": "FiberVNN", "Tên khách hàng": "A", __rowNumber: 2 },
    { "Mã thuê bao": "0901", "Tên dịch vụ": "", "Tên khách hàng": "A", __rowNumber: 3 },
    { "Mã thuê bao": "0902", "Tên dịch vụ": "Mega", "Tên khách hàng": "A", __rowNumber: 4 },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].rowNumber, 4);
  assert.deepEqual(
    errors.map((e) => [e.rowNumber, e.message]),
    [
      [2, "Thiếu mã thuê bao"],
      [3, "Thiếu tên dịch vụ"],
    ]
  );
  assert.equal(errors[0].row.serviceName, "FiberVNN");
});

test("rejects an invalid term in months and skips fully empty rows", () => {
  const { rows, errors } = parseServiceSheet([
    { "Mã thuê bao": "A", "Tên dịch vụ": "S", "Thời hạn (tháng)": "abc", __rowNumber: 2 },
    { "Mã thuê bao": "B", "Tên dịch vụ": "S", "Thời hạn (tháng)": "0", __rowNumber: 3 },
    { "Mã thuê bao": "C", "Tên dịch vụ": "S", "Thời hạn (tháng)": "24", __rowNumber: 4 },
    { "Mã thuê bao": "", "Tên dịch vụ": "", __rowNumber: 5 },
  ]);

  assert.equal(errors.length, 2);
  assert.match(errors[0].message, /Thời hạn \(tháng\) không hợp lệ/);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].termMonths, 24);
});

test("readWorkbookRows + parseServiceSheet read a real xlsx workbook", () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Mã khách hàng", "Mã thuê bao", "Tên dịch vụ", "Ngày bắt đầu"],
    ["KH1", "SUB1", "FiberVNN", "01/02/2026"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Dịch vụ");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const { rows, errors } = parseServiceSheet(readWorkbookRows(buffer));
  assert.equal(errors.length, 0);
  assert.equal(rows[0].rowNumber, 2);
  assert.equal(rows[0].customerCode, "KH1");
  assert.equal(rows[0].startDate, "2026-02-01");
});
