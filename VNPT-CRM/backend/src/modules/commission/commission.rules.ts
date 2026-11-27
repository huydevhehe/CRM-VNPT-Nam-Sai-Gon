import { CTV_COMMISSION_RATE, INTERNAL_COMMISSION_RATE } from "../../constants/org.js";

export const CTV_COMMISSION_TYPE = "Hoa hồng chi kênh";
export const CTV_COMMISSION_INITIAL_STATUS = "Chờ chi";

/** Hoa hồng nội bộ: đơn Hoàn tất không có CTV giới thiệu -> ghi nhận cho AM bán hàng của đơn. */
export const INTERNAL_COMMISSION_TYPE = "Hoa hồng nội bộ";
export const INTERNAL_COMMISSION_INITIAL_STATUS = "Chờ nhận";

/** Hoa hồng CTV = tỷ lệ cố định x giá trị hợp đồng, làm tròn đến đồng. */
export function calcCtvCommission(totalValue: number): number {
  return Math.round(totalValue * CTV_COMMISSION_RATE);
}

/** Hoa hồng nội bộ = tỷ lệ cố định x giá trị hợp đồng, làm tròn đến đồng. */
export function calcInternalCommission(totalValue: number): number {
  return Math.round(totalValue * INTERNAL_COMMISSION_RATE);
}
