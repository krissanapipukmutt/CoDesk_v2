import {
  BarChart3,
  Building2,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { RoleCode } from "../types";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
}
export const navigationForRole = (role: RoleCode): NavItem[] => {
  const items: NavItem[] = [
    { to: "/", labelKey: "navigation.dashboard", icon: LayoutDashboard },
    { to: "/bookings", labelKey: "navigation.booking", icon: CalendarPlus },
    { to: "/calendar", labelKey: "navigation.calendar", icon: CalendarRange },
  ];
  if (role === "hr" || role === "admin")
    items.push(
      { to: "/departments", labelKey: "navigation.departments", icon: Building2 },
      { to: "/employees", labelKey: "navigation.employees", icon: Users },
      { to: "/reports", labelKey: "navigation.reports", icon: BarChart3 },
    );
  items.push({ to: "/holidays", labelKey: "navigation.holidays", icon: CalendarDays });
  if (role === "admin")
    items.push({ to: "/admin/users", labelKey: "navigation.users", icon: ShieldCheck });
  return items;
};
