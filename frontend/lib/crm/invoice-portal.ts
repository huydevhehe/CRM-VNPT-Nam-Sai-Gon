/**
 * Khớp "Hóa đơn điện tử" trong tên dịch vụ (không phân biệt dấu/hoa thường) —
 * phải khớp CHÍNH XÁC logic `isInvoicePortalService` ở
 * `backend/src/modules/service/service.service.ts` để FE/BE đồng nhất khi
 * quyết định hiện khối "Thông tin đăng nhập hệ thống hóa đơn".
 */
export function isInvoicePortalServiceName(serviceName: string | null | undefined): boolean {
  if (!serviceName) return false;
  const normalized = serviceName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
  return normalized.includes("hoa don dien tu");
}
