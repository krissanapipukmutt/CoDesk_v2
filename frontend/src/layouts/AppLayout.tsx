import { Building2, Menu, UserRoundCog, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { isDemoMode } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { copy } from "../i18n/copy";
import type { RoleCode } from "../types";
import { cn } from "../utils/cn";
import { navigationForRole } from "./navigation";

export function AppNavigation({
  role,
  onNavigate,
}: {
  role: RoleCode;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1 px-3">
      {navigationForRole(role).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
              isActive
                ? "bg-[#eef2ff] text-[#3157d5]"
                : "text-[#475467] hover:bg-[#f8f9fc]",
            )
          }
        >
          <Icon size={19} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppLayout() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  if (!user) return null;
  const leave = async () => {
    await signOut();
    navigate("/auth");
  };
  const Sidebar = () => (
    <aside className="flex h-full flex-col bg-white">
      <div className="flex h-18 items-center gap-3 border-b border-[#e4e8f0] px-5">
        <div className="rounded-xl bg-[#3157d5] p-2 text-white">
          <Building2 size={22} />
        </div>
        <div>
          <div className="font-bold">CoDesk</div>
          <div className="text-xs text-[#667085]">{copy.tagline}</div>
        </div>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <AppNavigation role={user.roleCode} onNavigate={() => setOpen(false)} />
      </div>
      <div className="border-t border-[#e4e8f0] p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-full bg-[#eef2ff] p-2 text-[#3157d5]">
            <UserRoundCog size={18} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {user.fullName}
            </div>
            <div className="truncate text-xs text-[#667085]">
              {copy.roles[user.roleCode]} · {user.departmentCode}
            </div>
          </div>
        </div>
        <button
          className="w-full rounded-lg border border-[#d0d5dd] px-3 py-2 text-xs font-semibold text-[#475467]"
          onClick={() => void leave()}
        >
          {isDemoMode ? copy.switchRole : "ออกจากระบบ"}
        </button>
      </div>
    </aside>
  );
  return (
    <div className="min-h-screen">
      <div className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[#e4e8f0] lg:block">
        <Sidebar />
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="ปิดเมนู"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-72">
            <Sidebar />
          </div>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#e4e8f0] bg-white px-4 lg:ml-64 lg:px-8">
        <button
          aria-label="เปิดเมนู"
          className="lg:hidden"
          onClick={() => setOpen(true)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <div className="ml-auto flex items-center gap-3">
          {isDemoMode && (
            <span className="status-pill status-warning">{copy.demoMode}</span>
          )}
          <span className="hidden text-sm text-[#667085] sm:inline">
            Asia/Bangkok
          </span>
        </div>
      </header>
      <main className="p-4 lg:ml-64 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
