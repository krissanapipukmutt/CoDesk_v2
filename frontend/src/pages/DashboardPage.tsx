import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarCheck2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { apiFetch, toQuery } from "../api/client";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { ErrorState, LoadingState } from "../components/Feedback";
import { Card, PageHeader } from "../components/ui/Card";
import { bookingStatusLabel, localizedError, roleLabel } from "../i18n/format";
import type { Booking, PageResult } from "../types";
import { formatDateTime } from "../utils/date";

export function DashboardPage() {
  const { t } = useTranslation();
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
        title={t("dashboard.greeting", { name: user.fullName })}
        description={t("dashboard.description")}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Summary icon={<UserRound />} label={t("dashboard.role")} value={roleLabel(t, user.roleCode)} />
        <Summary
          icon={<Building2 />}
          label={t("dashboard.department")}
          value={`${user.departmentCode} · ${user.departmentName}`}
        />
        <Summary
          icon={<ShieldCheck />}
          label={t("dashboard.status")}
          value={user.isActive ? t("common.enabled") : t("common.inactive")}
        />
      </div>
      <Card className="mt-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <CalendarCheck2 size={20} className="text-[#3157d5]" />
          {t("dashboard.activeBookings")}
        </h2>
        {bookings.isLoading ? (
          <LoadingState />
        ) : bookings.isError ? (
          <ErrorState
            message={localizedError(t, bookings.error)}
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
                    {formatDateTime(
                      booking.startAt,
                      booking.businessTimezone,
                    )}{" "}
                    –{" "}
                    {formatDateTime(
                      booking.endAt,
                      booking.businessTimezone,
                    )}{" "}
                    ({booking.businessTimezone})
                  </div>
                </div>
                <span className="status-pill status-active">{bookingStatusLabel(t, "booked")}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-[#667085]">{t("dashboard.noBookings")}</p>
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
