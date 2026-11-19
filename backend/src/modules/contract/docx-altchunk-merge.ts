import PizZip from "pizzip";

/**
 * Gộp nhiều file .docx phụ lục vào cuối 1 file .docx chính bằng kỹ thuật OOXML
 * `altChunk`: mỗi phụ lục được nhúng nguyên vẹn như 1 part riêng
 * (`word/afchunkN.docx`), tham chiếu qua `<w:altChunk r:id="..."/>` ngay trước
 * `</w:body>` của file chính.
 *
 * CHỈ thao tác trên `[Content_Types].xml`, `word/_rels/document.xml.rels`
 * (string nối thêm trước tag đóng) và tìm chuỗi `</w:body>` CỐ ĐỊNH trong
 * `word/document.xml` để chèn 1 dòng — KHÔNG dò/cắt các thẻ `<w:r>`/`<w:p>`
 * lồng nhau của 2 tài liệu, nên không có rủi ro làm hỏng XML như cách cắt
 * chuỗi thủ công trước đây.
 *
 * Word và LibreOffice đều hỗ trợ sẵn altChunk để mở nhiều docx ghép lại
 * thành 1 file duy nhất.
 */
export function mergeDocxWithAltChunkAppendices(mainDocx: Buffer, appendices: Buffer[]): Buffer {
  if (!appendices.length) return mainDocx;

  const zip = new PizZip(mainDocx);

  const documentPath = "word/document.xml";
  const relsPath = "word/_rels/document.xml.rels";
  const contentTypesPath = "[Content_Types].xml";

  const documentFile = zip.file(documentPath);
  const contentTypesFile = zip.file(contentTypesPath);
  if (!documentFile || !contentTypesFile) {
    throw new Error("File docx chính thiếu word/document.xml hoặc [Content_Types].xml, không thể gộp phụ lục");
  }
  let documentXml = documentFile.asText();
  let contentTypesXml = contentTypesFile.asText();

  const relsFile = zip.file(relsPath);
  let relsXml =
    relsFile?.asText() ??
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

  if (!documentXml.includes("</w:body>")) {
    throw new Error("word/document.xml không có </w:body>, không thể chèn altChunk phụ lục");
  }
  if (!relsXml.includes("</Relationships>")) {
    throw new Error("word/_rels/document.xml.rels không hợp lệ, không thể chèn relationship altChunk");
  }
  if (!contentTypesXml.includes("</Types>")) {
    throw new Error("[Content_Types].xml không hợp lệ, không thể khai báo part altChunk");
  }

  const existingRelIds = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => parseInt(m[1], 10));
  let nextRelId = (existingRelIds.length ? Math.max(...existingRelIds) : 0) + 1;

  // Ngắt trang trước mỗi phụ lục altChunk: nếu không, Word render phụ lục
  // nối liền ngay sau đoạn cuối (vd. chữ ký) của hợp đồng chính trên cùng 1 trang.
  const PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

  const altChunkTags: string[] = [];
  const newRelEntries: string[] = [];
  const newContentTypeEntries: string[] = [];

  appendices.forEach((appendixBuf, idx) => {
    const partName = `afchunk${idx + 1}.docx`;
    const relId = `rId${nextRelId++}`;
    zip.file(`word/${partName}`, appendixBuf);
    newRelEntries.push(
      `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="${partName}"/>`
    );
    newContentTypeEntries.push(
      `<Override PartName="/word/${partName}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document"/>`
    );
    altChunkTags.push(PAGE_BREAK + `<w:altChunk r:id="${relId}"/>`);
  });

  relsXml = relsXml.replace("</Relationships>", newRelEntries.join("") + "</Relationships>");
  contentTypesXml = contentTypesXml.replace("</Types>", newContentTypeEntries.join("") + "</Types>");
  documentXml = documentXml.replace("</w:body>", altChunkTags.join("") + "</w:body>");

  zip.file(documentPath, documentXml);
  zip.file(relsPath, relsXml);
  zip.file(contentTypesPath, contentTypesXml);

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
