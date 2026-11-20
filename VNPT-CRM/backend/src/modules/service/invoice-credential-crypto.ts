import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Mã hóa mật khẩu đăng nhập hệ thống Hóa đơn điện tử (AES-256-GCM).
 * Khóa lấy từ biến môi trường `INVOICE_CREDENTIAL_KEY` (chuỗi bất kỳ, được băm
 * SHA-256 thành khóa 32 byte) để tránh yêu cầu đúng định dạng base64/hex 32 byte.
 * Chuỗi mã hóa lưu DB dạng "iv:tag:ciphertext" (hex). KHÔNG BAO GIỜ lưu plaintext.
 */
function resolveKey(): Buffer {
  const raw = process.env.INVOICE_CREDENTIAL_KEY;
  if (!raw) {
    throw new Error(
      "Chưa cấu hình INVOICE_CREDENTIAL_KEY trên máy chủ, không thể lưu/đọc mật khẩu hệ thống hóa đơn"
    );
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptInvoicePassword(plaintext: string): string {
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptInvoicePassword(encoded: string): string {
  const key = resolveKey();
  const parts = encoded.split(":");
  if (parts.length !== 3) {
    throw new Error("Dữ liệu mật khẩu đã lưu không hợp lệ");
  }
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Mặt nạ hiển thị cho danh sách/xem thường — không bao giờ lộ độ dài thật. */
export const MASKED_PASSWORD = "••••••";
