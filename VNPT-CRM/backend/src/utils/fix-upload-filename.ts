/**
 * multer/busboy giải mã header `filename` của multipart/form-data theo
 * latin1 mặc định (RFC 2388 không bắt buộc UTF-8), nên tên file tiếng Việt
 * có dấu do trình duyệt gửi lên (đã mã hoá UTF-8) bị đọc sai thành chữ lỗi
 * font kiểu "Giáº¥y phÃ©p kinh doanh.pdf" thay vì "Giấy phép kinh doanh.pdf".
 * Giải mã lại đúng UTF-8 ngay sau khi multer parse xong, trước khi dùng
 * `file.originalname` ở bất kỳ đâu (lưu DB, hiển thị, kiểm tra đuôi file...).
 */
export function fixUploadFilenameEncoding(originalname: string): string {
  return Buffer.from(originalname, "latin1").toString("utf8");
}

export function fixMulterFileEncoding(file: Express.Multer.File | undefined): void {
  if (file) file.originalname = fixUploadFilenameEncoding(file.originalname);
}
