/** HTTP header chỉ nhận ký tự Latin-1 in được — tên file gợi ý (vd lấy từ số văn bản
 * chưa cấp, đang hiện tạm "…") phải được làm sạch trước khi nhét vào Content-Disposition,
 * nếu không Node ném lỗi "Invalid character in header content". */
export function asciiSafeFilename(name: string): string {
  const cleaned = name.replace(/[^\x20-\x7E]/g, "");
  return cleaned.trim() || "file";
}
