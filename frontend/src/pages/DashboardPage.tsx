import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarCheck2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { apiFetch, toQuery } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { ErrorState, LoadingState } from "../components/Feedback";
import { Card, PageHeader } from "../components/ui/Card";
import type { Booking, PageResult } from "../types";
import { formatDateTime } from "../utils/date";

export function DashboardPage() {
  const { user } = useAuth();
  const bookings = useQuery({
    queryKey: ["dashboard-bookings"],
    queryFn: () =>
      apiFetch<PageResult<Booking>>(
        "/api/bookings" + toQuery({ status: "booked", pageSize: 5 }),
      ),
  });
  if (!user) return null;
  return (
    <>
      <PageHeader
        title={`สวัสดี ${user.fullName}`}
        description="ภาพรวมการจองเข้าออฟฟิศของคุณ"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Summary icon={<UserRound />} label="บทบาท" value={user.roleName} />
        <Summary
          icon={<Building2 />}
          label="ฝ่ายงาน"
          value={`${user.departmentCode} · ${user.departmentName}`}
        />
        <Summary
          icon={<ShieldCheck />}
          label="สถานะ"
          value={user.isActive ? "พร้อมใช้งาน" : "ปิดใช้งาน"}
        />
      </div>
      <Card className="mt-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <CalendarCheck2 size={20} className="text-[#3157d5]" />
          รายการจองที่ยังใช้งาน
        </h2>
        {bookings.isLoading ? (
          <LoadingState />
        ) : bookings.isError ? (
          <ErrorState
            message={bookings.error.message}
            onRetry={() => void bookings.refetch()}
          />
        ) : bookings.data?.items.length ? (
          <div className="space-y-3">
            {bookings.data.items.map((booking) => (
              <div
                key={booking.bookingId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e4e8f0] p-3"
              >
                <div>
                  <div className="font-semibold">{booking.bookedForName}</div>
                  <div className="text-sm text-[#667085]">
                    {formatDateTime(booking.startAt)} –{" "}
                    {formatDateTime(booking.endAt)}
                  </div>
                </div>
                <span className="status-pill status-active">จองแล้ว</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-[#667085]">ยังไม่มีรายการจอง</p>
        )}
      </Card>
    </>
  );
}
function Summary({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <div className="mb-3 inline-flex rounded-xl bg-[#eef2ff] p-2 text-[#3157d5]">
        {icon}
      </div>
      <div className="text-sm text-[#667085]">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </Card>
  );
}
