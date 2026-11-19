import test from "node:test";
import assert from "node:assert/strict";
import PizZip from "pizzip";
import { mergeDocxWithAltChunkAppendices } from "./docx-altchunk-merge.js";

function fakeDocx(bodyXml: string): Buffer {
  const zip = new PizZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:body>${bodyXml}</w:body></w:document>`
  );
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
  );
  return zip.generate({ type: "nodebuffer" });
}

test("mergeDocxWithAltChunkAppendices chèn ngắt trang TRƯỚC mỗi altChunk (không bị dính liền trang chữ ký)", () => {
  const main = fakeDocx("<w:p><w:r><w:t>Hết hợp đồng chính</w:t></w:r></w:p>");
  const appendix1 = fakeDocx("<w:p><w:r><w:t>Phụ lục 1</w:t></w:r></w:p>");
  const appendix2 = fakeDocx("<w:p><w:r><w:t>Phụ lục 2</w:t></w:r></w:p>");

  const merged = mergeDocxWithAltChunkAppendices(main, [appendix1, appendix2]);
  const zip = new PizZip(merged);
  const documentXml = zip.file("word/document.xml")!.asText();

  const pageBreakBeforeAltChunk = /<w:p><w:r><w:br w:type="page"\/><\/w:r><\/w:p><w:altChunk r:id="rId\d+"\/>/g;
  const matches = documentXml.match(pageBreakBeforeAltChunk);
  assert.equal(matches?.length, 2, "Phải có đúng 2 đoạn ngắt trang, mỗi đoạn ngay trước 1 altChunk");
});

test("mergeDocxWithAltChunkAppendices không chèn gì nếu không có phụ lục", () => {
  const main = fakeDocx("<w:p><w:r><w:t>Nội dung</w:t></w:r></w:p>");
  const merged = mergeDocxWithAltChunkAppendices(main, []);
  assert.equal(merged, main);
});
