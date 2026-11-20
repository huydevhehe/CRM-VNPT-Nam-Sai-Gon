export type CustomerType = "Doanh nghiệp" | "Hộ kinh doanh" | "Cá nhân";
export type CustomerGroup = "Tự phát triển" | "Tập hiện hữu" | "PTM địa bàn";
export type DocumentType = "GPKD" | "CCCD" | "KHAC";
export type StaffRole = "Admin" | "AM" | "AM Bán chăm" | "Người xem";
export type UserRole = "Admin" | "AM" | "AM Bán chăm" | "CTV";

export type DebtStatus = "Đã gạch nợ" | "Nợ cước";
export type RenewalStatus = "Chưa xử lý" | "Khách hẹn thanh toán" | "Hoàn thành" | "Thất bại";
export type RenewalFailureReason = "Tạm ngưng" | "Thanh lý";

export type DeploymentStatus = "Chưa triển khai" | "Đang triển khai" | "Hoàn tất" | "Tạm dừng" | "Hủy";
export type PaymentStatus = "Chưa thanh toán" | "Đã thanh toán";
export type DocumentStatus = "Soạn thảo" | "Khách trình ký" | "Hoàn thiện bàn giao";

export type LeadStatus = "Mới tiếp nhận" | "Đã liên hệ" | "Đang tư vấn" | "Chốt thành công" | "Thất bại";
export type TaskStatus = "Mới" | "Đang làm" | "Hoàn tất" | "Quá hạn";
export type TaskPriority = "Thấp" | "Vừa" | "Cao";

// 1. Debt (Khớp Sheet 1: THU NGAY , LŨY KẾ)
export interface DebtRecord {
  id: string;
  staffName: string; // TÊN NHÂN VIÊN CHĂM
  serviceGroup: string; // NHOM_DV
  paymentCode: string; // MA_THANH TOÁN
  subscriberCode: string; // MA_THUÊ BAO
  customerName: string; // TEN_THUÊ BAO
  installationAddress: string; // DIACHI_LD
  immediateDebt: number; // CONNO_THUNGAY
  cumulativeDebt: number; // CONNO_LUYKE
  collectedAmount: number;
  status: DebtStatus;
  documentRef?: string;
  month: string;
}

// 2. Renewal (Khớp Sheet 2: GIA HẠN)
export interface RenewalRecord {
  id: string;
  transactionCode: string; // MÃ GIAO DỊCH
  subscriberCode: string; // MA_THUÊ BAO
  customerName: string; // TEN_THUÊ BAO
  paymentCode: string; // MA_THANH TOÁN
  installationAddress: string; // DIACHI_LD
  staffName: string; // TÊN NHÂN VIÊN CHĂM
  termAmount: number;
  durationMonths: number;
  cohort: "THÁNG T" | "THÁNG T-1";
  status: RenewalStatus;
  failureReason?: RenewalFailureReason;
  expiryDate?: string | null; // Ngày hết hạn dịch vụ (YYYY-MM-DD)
  renewedAt?: string | null; // Ngày gia hạn thành công (YYYY-MM-DD)
}

// 3. Customer
export interface CustomerRecord {
  id: string;
  name: string;
  identityCode: string; // MST (10/14) hoặc CCCD (12)
  type: CustomerType;
  group: CustomerGroup;
  phone: string; // SĐT liên hệ
  address: string;
  services: string[];
  nearestExpiration: string;
  amStaff: string;
  amCaringStaff: string;
  handoverBatch?: string; // Đợt giao (rỗng nếu chưa có)
  handoverDate?: string; // Ngày giao (rỗng nếu chưa có)
  territoryId?: string;
  territoryName?: string;
  customerCode?: string;
  status?: string;
  teamId?: string;
  teamName?: string;
  salesChannel?: string;
  contactName?: string;
  contactEmail?: string;
  billingName?: string;
  billingPhone?: string;
  billingEmail?: string;
  note?: string;
  referredByCtvId?: string;
  referredByCtvName?: string;
  referredByCtvCode?: string;
  channelSourceId?: string | null;
  channelSourceName?: string | null;
}

// 4. Service & Alert
export interface ServiceRecord {
  id: string;
  customerName: string;
  serviceName: string;
  serviceCode: string;
  startDate: string;
  expirationDate: string;
  daysRemaining: number;
  staffName: string;
  isExpired: boolean;
  customerId?: string | null;
  serviceGroup?: string | null;
  packageName?: string | null;
  paymentType?: string | null;
  contractId?: string | null;
  transactionCode?: string | null;
  /** true nếu dịch vụ thuộc nhóm "Hóa đơn điện tử" (hiện khối thông tin đăng nhập). */
  isInvoicePortalService?: boolean;
  invoicePortalUrl?: string | null;
  invoicePortalUsername?: string | null;
  /** "••••••" nếu đã có mật khẩu; không bao giờ là plaintext. */
  invoicePortalPasswordMasked?: string | null;
}

// 5. Lead
export interface LeadRecord {
  id: string;
  customerName: string;
  phone: string;
  group: "Lead KH mới" | "Lead gia hạn" | "Lead bán chéo DV";
  channel: "Online" | "CTV giới thiệu" | "Đối tác" | "Khách hàng hiện hữu" | "Chiến dịch";
  staffName: string;
  status: LeadStatus;
  expectedValue: number;
  demandDescription: string;
  territoryId?: string;
  referredByCtvId?: string;
  referredByCtvName?: string | null;
  channelSourceId?: string | null;
  channelSourceName?: string | null;
  channelSourceKind?: "online" | "partner" | null;
  note?: string | null;
  /** Yêu cầu quay lại bước trước đang chờ Admin duyệt. */
  pendingStageRequest?: LeadPendingStageRequest | null;
}

export interface LeadPendingStageRequest {
  id: string;
  toStatus: LeadStatus;
  reason: string;
  requestedBy: string;
  createdAt: string | null;
}

export type ContractLineType = "service" | "device";

/** Khớp `ContractItemDto` ở `backend/src/modules/contract/contract-items.ts`. */
export interface ContractItemRecord {
  id: string;
  lineNo: number;
  lineType: ContractLineType;
  serviceGroup: string | null;
  serviceName: string | null;
  packageName: string | null;
  subscriberCode: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  termMonths: number | null;
  startDate: string | null;
  note: string | null;
  legacy: boolean;
}

export interface ContractItemInput {
  lineType: ContractLineType;
  serviceGroup?: string | null;
  serviceName?: string | null;
  packageName?: string | null;
  subscriberCode?: string | null;
  quantity?: number | null;
  unitPrice: number;
  termMonths?: number | null;
  startDate?: string | null;
  note?: string | null;
}

// 6. Contract
export interface ContractRecord {
  id: string;
  transactionCode: string;
  customerName: string;
  subscriberCodes: string[];
  totalValue: number;
  channel: string;
  deploymentStatus: DeploymentStatus;
  paymentStatus: PaymentStatus;
  documentStatus: DocumentStatus;
  hasRevenue: boolean;
  leadId?: string;
  territoryId?: string;
  referredByCtvId?: string;
  amStaff?: string | null;
  serviceGroup?: string | null;
  serviceName?: string | null;
  packageName?: string | null;
  paymentMethod?: string | null;
  customerId?: string | null;
  taxCode?: string | null;
  contractNumber?: string | null;
  signedDate?: string | null;
  termMonths?: number | null;
  prepaidMonths?: number | null;
  collectedAmount?: number;
  channelSourceId?: string | null;
  channelSourceName?: string | null;
  /** Thông điệp hoa hồng CTV ngay sau khi lưu (vd đã có hoa hồng CTV khác, hoặc không có CTV nên không phát sinh). */
  commissionNotice?: string | null;
  /** Các dòng dịch vụ/thiết bị của đơn (T9, STT 10). Luôn có ít nhất 1 dòng. */
  items?: ContractItemRecord[];
  /** Mẫu hợp đồng (T10, STT 11) — null cho đơn cũ, bắt buộc khi tạo mới. */
  contractTemplate?: string | null;
}

/** Một mẫu trong bộ hợp đồng chuẩn (T10, STT 11). `available = false` -> chưa có file mẫu, chỉ hiển thị "Chưa có mẫu". */
export interface ContractTemplateOption {
  key: string;
  label: string;
  available: boolean;
  file?: string;
  supportsItemsTable?: boolean;
}

// 7. Commission
export interface CommissionRecord {
  id: string;
  recipientName: string;
  type: "Hoa hồng nội bộ" | "Hoa hồng chi kênh";
  transactionCode: string;
  amount: number;
  status: "Đã nhận" | "Chờ nhận" | "Đã chi" | "Chờ chi";
  date: string;
  ctvId?: string | null;
  contractId?: string | null;
  note?: string | null;
  /** Người giới thiệu: tên CTV, hoặc recipient_name (chi kênh không CTV), hoặc AM tiếp thị của đơn (nội bộ). */
  referrerName: string | null;
  referrerCode: string | null;
  customerName: string | null;
  /** "Khách đã chi" tự tính từ đơn hàng; null nếu không gắn đơn hàng nào. */
  customerPaidAuto: number | null;
  /** Admin ghi đè; null = dùng số tự tính. */
  customerPaidOverride: number | null;
  /** customerPaidOverride ?? customerPaidAuto. */
  customerPaid: number | null;
  paidOutAmount: number;
  paidOutDate: string | null;
  /** amount - paidOutAmount; có thể âm nếu chi vượt. */
  remaining: number;
}

export interface ReferrerSummaryRecord {
  referrerName: string;
  referrerCode: string | null;
  customerCount: number;
  orderCount: number;
  totalCustomerPaid: number;
  totalCommission: number;
  totalPaidOut: number;
  totalRemaining: number;
}

// 8. Territory (7 Phường)
export interface TerritoryRecord {
  id: string;
  wardName: string;
  quarterCount: number; // Khu phố
  householdCount: number; // Hộ dân
  opportunityCount: number; // Cơ hội CĐS
  deployedCount: number; // Đã ký HĐ và có doanh thu
  staffName: string;
  leadershipContact: string;
  population: number; // Dân số
  schoolMamnon: number; // Số trường Mầm non
  schoolTieuhoc: number; // Số trường Tiểu học
  schoolThcs: number; // Số trường THCS
  schoolThpt: number; // Số trường THPT
  revenue: number; // Doanh thu đã triển khai
}

// 8b. Ward contact (đầu mối nhân sự theo Đơn vị/Phòng ban trong 1 phường)
export interface WardContactRecord {
  id: string;
  territoryId: string;
  unit: string; // Đơn vị: Trạm Y tế, UBND, Đảng ủy, Trường học...
  department: string; // Phòng ban: Hành chính nhân sự, Mầm non, THCS...
  fullName: string; // Họ tên
  position: string; // Chức: Trưởng phòng, Hiệu trưởng...
  phone: string;
  amInCharge: string; // AM phụ trách
}

// 9. Staff
export type StaffStatus = "Đang hoạt động" | "Đình chỉ" | "Ngừng hoạt động" | "Tạm nghỉ";
export type StaffType = "Chính thức" | "Cộng tác viên";

/** Doanh thu nhân viên tính từ đơn hàng (contracts/contract_payments), theo tháng được chọn. */
export interface StaffRevenue {
  closedMonth: number;
  closedTotal: number;
  collectedMonth: number;
  collectedTotal: number;
}

export interface StaffRecord {
  id: string;
  code: string;
  name: string;
  role: "AM" | "AM Bán chăm" | "Admin";
  territory: string;
  assignedCustomers: number;
  monthlyLeads: number;
  monthlyContracts: number;
  revenueExecuted: number;
  collectionRate: number;
  renewalRate: number;
  status: StaffStatus;
  email: string;
  username?: string;
  hrmCode?: string | null;
  staffType?: StaffType | null;
  phone?: string | null;
  birthDate?: string | null;
  personalEmail?: string | null;
  shortName?: string | null;
  note?: string | null;
  statusReason?: string | null;
  statusChangedAt?: string | null;
  statusChangedBy?: string | null;
  /** Doanh thu tính từ đơn hàng; chỉ có khi lấy qua getStaff() với tham số month. */
  revenue?: StaffRevenue;
  /** Tên các phường nhân viên đang phụ trách (một nhân viên có thể phụ trách nhiều phường). */
  territories?: string[];
}

// 10. Task
export interface TaskRecord {
  id: string;
  title: string;
  relatedTarget: string;
  assignee: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  notes?: string;
}

// 11. Audit Log
export interface AuditLogRecord {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

// 12. Chi tiết Phường (lãnh đạo, khu phố, lead dự án, hợp đồng)
export interface WardOfficialRecord {
  id: string;
  territoryId: string;
  unit: string;
  position: string;
  fullName: string;
  phone: string;
}

export interface QuarterRecord {
  id: string;
  territoryId: string;
  name: string;
  headName: string;
  secretaryName: string;
  mttqName: string;
  householdCount: number;
  population: number;
}

export interface TerritoryDetail {
  territory: {
    id: string;
    wardName: string;
    quarterCount: number;
    householdCount: number;
    opportunityCount: number;
    deployedCount: number;
    staffName: string;
    leadershipContact: string;
    population: number;
    schoolMamnon: number;
    schoolTieuhoc: number;
    schoolThcs: number;
    schoolThpt: number;
    revenue: number;
  };
  officials: WardOfficialRecord[];
  quarters: QuarterRecord[];
  leads: {
    id: string;
    customerName: string;
    status: LeadStatus;
    expectedValue: number;
    channel: string;
    staffName: string;
  }[];
  contracts: {
    id: string;
    transactionCode: string;
    customerName: string;
    totalValue: number;
    deploymentStatus: DeploymentStatus;
    paymentStatus: PaymentStatus;
  }[];
  totals: {
    quarterCount: number;
    householdCount: number;
    population: number;
    leadCount: number;
    contractCount: number;
    contractValue: number;
  };
}

// 13. Cộng tác viên (CTV)
export interface CtvAccountRecord {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  referralCode: string;
  status: "Đang hoạt động" | "Chờ duyệt" | "Từ chối";
  createdAt: string;
  approvedAt: string;
}

export interface CtvProfile {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  referralCode: string;
}

export interface CtvSummary {
  totalLeads: number;
  successfulLeads: number;
  failedLeads: number;
  totalContracts: number;
  completedContracts: number;
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
}

export interface CtvLeadRecord {
  id: string;
  customerName: string;
  maskedPhone: string;
  group: LeadRecord["group"];
  status: LeadStatus;
  expectedValue: number;
  createdAt: string;
  contractStatus: string;
}

export interface CtvContractRecord {
  id: string;
  transactionCode: string;
  customerName: string;
  totalValue: number;
  deploymentStatus: DeploymentStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

export interface CtvCommissionRecord {
  id: string;
  transactionCode: string;
  amount: number;
  status: CommissionRecord["status"];
  date: string;
}
