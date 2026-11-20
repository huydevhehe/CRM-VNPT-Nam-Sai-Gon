export const ADMIN_ROLE = "Admin";

/** Các trang quản trị chỉ Admin được vào (khớp quyền chặn thật ở backend). */
export const ADMIN_ONLY_PATHS = [
  "/admin/commissions",
  "/admin/kpi-settings",
  "/admin/reminders",
  "/admin/ctv-accounts",
  "/admin/employees",
  "/admin/settings",
  "/admin/system-settings",
  "/admin/data-transfer",
  "/admin/channel-sources",
] as const;

export function isAdminOnlyPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return ADMIN_ONLY_PATHS.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`)
  );
}

export function canAccessAdminPath(
  role: string | null | undefined,
  pathname: string | null | undefined
): boolean {
  return role === ADMIN_ROLE || !isAdminOnlyPath(pathname);
}
