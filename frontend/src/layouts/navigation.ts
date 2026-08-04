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
import { copy } from "../i18n/copy";
import type { RoleCode } from "../types";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}
export const navigationForRole = (role: RoleCode): NavItem[] => {
  const items: NavItem[] = [
    { to: "/", label: copy.nav.dashboard, icon: LayoutDashboard },
    { to: "/bookings", label: copy.nav.booking, icon: CalendarPlus },
    { to: "/calendar", label: copy.nav.calendar, icon: CalendarRange },
  ];
  if (role === "hr" || role === "admin")
    items.push(
      { to: "/departments", label: copy.nav.departments, icon: Building2 },
      { to: "/employees", label: copy.nav.employees, icon: Users },
      { to: "/reports", label: copy.nav.reports, icon: BarChart3 },
    );
  if (role === "admin")
    items.push(
      { to: "/holidays", label: copy.nav.holidays, icon: CalendarDays },
      { to: "/admin/users", label: copy.nav.users, icon: ShieldCheck },
    );
  return items;
};
