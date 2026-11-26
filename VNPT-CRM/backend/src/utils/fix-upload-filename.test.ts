import test from "node:test";
import assert from "node:assert/strict";
import { fixUploadFilenameEncoding, fixMulterFileEncoding } from "./fix-upload-filename.js";

test("fixUploadFilenameEncoding decodes a UTF-8 filename mojibake-read-as-latin1 back to Vietnamese", () => {
  const original = "Giấy phép kinh doanh.pdf";
  // Mô phỏng đúng những gì multer/busboy làm: đọc byte UTF-8 của trình duyệt
  // gửi lên nhưng diễn giải theo latin1.
  const mojibake = Buffer.from(original, "utf8").toString("latin1");
  assert.notEqual(mojibake, original, "phải tái hiện đúng lỗi trước khi test fix");

  const fixed = fixUploadFilenameEncoding(mojibake);
  assert.equal(fixed, original);
});

test("fixUploadFilenameEncoding để nguyên tên file chỉ có ký tự ASCII", () => {
  assert.equal(fixUploadFilenameEncoding("report-2026.xlsx"), "report-2026.xlsx");
});

test("fixMulterFileEncoding sửa originalname của file, bỏ qua khi không có file", () => {
  const original = "Hợp đồng dịch vụ.docx";
  const mojibake = Buffer.from(original, "utf8").toString("latin1");
  const file = { originalname: mojibake } as Express.Multer.File;

  fixMulterFileEncoding(file);
  assert.equal(file.originalname, original);

  assert.doesNotThrow(() => fixMulterFileEncoding(undefined));
});
