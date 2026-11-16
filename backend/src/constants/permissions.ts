import { ROLES } from "./org.js";

export const ACCESS_LEVELS = {
  FULL: "Toàn quyền",
  OWN: "Chỉ dữ liệu của mình",
  VIEW: "Chỉ xem",
  NONE: "Không có quyền",
} as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[keyof typeof ACCESS_LEVELS];

export const PERMISSION_ROLES = [ROLES.ADMIN, ROLES.AM, ROLES.AM_BAN_CHAM] as const;
export type PermissionRole = (typeof PERMISSION_ROLES)[number];

export interface PermissionModule {
  key: string;
  label: string;
  note: string;
  access: Record<PermissionRole, AccessLevel>;
}

export interface PermissionRoleInfo {
  role: PermissionRole;
  label: string;
  badge: string;
  description: string;
}

export interface PermissionMatrix {
  levels: AccessLevel[];
  roles: PermissionRoleInfo[];
  modules: PermissionModule[];
}

export interface RolePermission {
  key: string;
  label: string;
  level: AccessLevel;
  note: string;
}

const { FULL, OWN, VIEW, NONE } = ACCESS_LEVELS;

const AM_ACCESS = (level: AccessLevel): Record<PermissionRole, AccessLevel> => ({
  [ROLES.ADMIN]: FULL,
  [ROLES.AM]: level,
  [ROLES.AM_BAN_CHAM]: level,
});

const ADMIN_ONLY: Record<PermissionRole, AccessLevel> = AM_ACCESS(NONE);

export const PERMISSION_MODULES: readonly PermissionModule[] = [
  {
    key: "dashboard",
    label: "Dashboard tổng hợp",
    note: "Số liệu tổng hợp của đơn vị; AM chỉ xem, không chỉnh sửa.",
    access: AM_ACCESS(VIEW),
  },
  {
    key: "leads",
    label: "Lead / Cơ hội",
    note: "AM chỉ thấy và xử lý Lead của mình. Giao Lead / đổi AM phụ trách chỉ Admin.",
    access: AM_ACCESS(OWN),
  },
  {
    key: "customers",
    label: "Khách hàng",
    note: "AM xem được toàn bộ danh sách khách để tra cứu và tránh trùng, nhưng chỉ sửa khách mình phụ trách (AM bán hàng hoặc AM CSKH). Chuyển AM, gán Team, nhập Excel, tạo đợt bàn giao chỉ Admin.",
    access: AM_ACCESS(VIEW),
  },
  {
    key: "orders",
    label: "Đơn hàng",
    note: "AM chỉ thấy đơn hàng của mình. Nhập file hợp đồng và xóa thanh toán chỉ Admin.",
    access: AM_ACCESS(OWN),
  },
  {
    key: "services",
    label: "Dịch vụ",
    note: "AM chỉ thấy dịch vụ của mình. Xóa dịch vụ và nhập Excel chỉ Admin.",
    access: AM_ACCESS(OWN),
  },
  {
    key: "payment_requests",
    label: "Đề nghị thanh toán",
    note: "AM chỉ thấy đề nghị thanh toán của đơn hàng mình phụ trách.",
    access: AM_ACCESS(OWN),
  },
  {
    key: "debts",
    label: "Quản lý nợ",
    note: "AM chỉ thấy nợ của khách được giao. Thêm và nhập nợ chỉ Admin.",
    access: AM_ACCESS(OWN),
  },
  {
    key: "renewals",
    label: "Gia hạn",
    note: "AM chỉ thấy gia hạn của khách được giao. Nhập và sửa ngày gia hạn chỉ Admin.",
    access: AM_ACCESS(OWN),
  },
  {
    key: "tasks",
    label: "Công việc / Nhắc việc",
    note: "AM chỉ thấy và xử lý công việc được giao cho mình.",
    access: AM_ACCESS(OWN),
  },
  {
    key: "kpi",
    label: "KPI",
    note: "AM chỉ xem chỉ tiêu và kết quả của mình. Cấu hình công thức, chỉ tiêu chỉ Admin.",
    access: AM_ACCESS(OWN),
  },
  {
    key: "territories",
    label: "Phường xã (Địa bàn)",
    note: "AM xem thông tin địa bàn; mọi thao tác ghi vào Địa bàn chỉ Admin.",
    access: AM_ACCESS(VIEW),
  },
  {
    key: "commissions",
    label: "Hoa hồng",
    note: "Chỉ Admin.",
    access: ADMIN_ONLY,
  },
  {
    key: "reports",
    label: "Báo cáo & Nhật ký hệ thống",
    note: "Chỉ Admin.",
    access: ADMIN_ONLY,
  },
  {
    key: "reminders",
    label: "Nhắc hết hạn (Email)",
    note: "Chỉ Admin.",
    access: ADMIN_ONLY,
  },
  {
    key: "ctv",
    label: "Cộng tác viên",
    note: "Chỉ Admin duyệt và quản lý tài khoản Cộng tác viên.",
    access: ADMIN_ONLY,
  },
  {
    key: "staff",
    label: "Nhân viên & Tài khoản",
    note: "Chỉ Admin tạo, sửa, đình chỉ nhân viên và đặt lại mật khẩu. AM chỉ thấy danh bạ rút gọn khi chọn người phụ trách.",
    access: ADMIN_ONLY,
  },
  {
    key: "data_transfer",
    label: "Chuyển dữ liệu hàng loạt",
    note: "Chỉ Admin.",
    access: ADMIN_ONLY,
  },
  {
    key: "system_settings",
    label: "Cài đặt hệ thống / SMTP",
    note: "Chỉ Admin.",
    access: ADMIN_ONLY,
  },
];

export const PERMISSION_ROLE_INFO: readonly PermissionRoleInfo[] = [
  {
    role: ROLES.ADMIN,
    label: "Quản trị viên (Admin)",
    badge: "Toàn quyền",
    description:
      "Xem toàn bộ dữ liệu đơn vị; quản lý nhân viên, tài khoản, hoa hồng, báo cáo, cấu hình KPI, cài đặt hệ thống, điều chuyển khách và dữ liệu hàng loạt.",
  },
  {
    role: ROLES.AM,
    label: "AM",
    badge: "Dữ liệu của mình",
    description:
      "Chỉ xem và xử lý Lead, công việc, dịch vụ, đơn hàng, đề nghị thanh toán của chính mình; khách hàng, nợ, gia hạn chỉ với khách được giao. Không có quyền với các mục chỉ Admin.",
  },
  {
    role: ROLES.AM_BAN_CHAM,
    label: "AM Bán chăm",
    badge: "Dữ liệu của mình",
    description:
      "Quyền như AM: chỉ làm việc trên dữ liệu của mình và khách được giao (bán hàng hoặc chăm sóc). Không có quyền với các mục chỉ Admin.",
  },
];

export function getPermissionMatrix(): PermissionMatrix {
  return {
    levels: Object.values(ACCESS_LEVELS),
    roles: PERMISSION_ROLE_INFO.map((r) => ({ ...r })),
    modules: PERMISSION_MODULES.map((m) => ({ ...m, access: { ...m.access } })),
  };
}

export function getRolePermissions(role: string): RolePermission[] {
  if (!(PERMISSION_ROLES as readonly string[]).includes(role)) {
    return [];
  }
  return PERMISSION_MODULES.map((m) => ({
    key: m.key,
    label: m.label,
    level: m.access[role as PermissionRole],
    note: m.note,
  }));
}
