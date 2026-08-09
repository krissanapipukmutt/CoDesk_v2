import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import thLocale from "@fullcalendar/core/locales/th";
import FullCalendar from "@fullcalendar/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { apiFetch, isDemoMode, toQuery } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { ErrorState } from "../components/Feedback";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import type { Booking, PageResult } from "../types";
import { bookingStatusLabel, localizedError } from "../i18n/format";
import { formatDateTime, toCalendarWallTime } from "../utils/date";

export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState({
    start: "2026-08-01",
    end: "2026-08-31",
  });
  const [selected, setSelected] = useState<Booking | null>(null);
  const query = useQuery({
    queryKey: ["calendar", range],
    queryFn: () =>
      apiFetch<PageResult<Booking>>(
        "/api/calendar" +
          toQuery({ dateFrom: range.start, dateTo: range.end, pageSize: 500 }),
      ),
  });
  if (!user) return null;
  const events =
    query.data?.items.map((booking) => ({
      id: booking.bookingId,
      title: `${booking.bookedForName} · ${booking.departmentCode}`,
      start:
        booking.bookingMode === "single_day"
          ? booking.bookingDateStart
          : toCalendarWallTime(booking.startAt, user.timezoneName),
      end:
        booking.bookingMode === "single_day"
          ? undefined
          : toCalendarWallTime(booking.endAt, user.timezoneName),
      allDay: booking.bookingMode === "single_day",
      color:
        booking.statusCode === "cancelled"
          ? "#98a2b3"
          : booking.departmentId === user.departmentId
            ? "#3157d5"
            : "#7a5af8",
      extendedProps: { booking },
    })) ?? [];
  return (
    <>
      <PageHeader
        title={t("calendar.title")}
        description={
          user.roleCode === "admin"
            ? t("calendar.adminDescription", { timezone: user.timezoneName })
            : t("calendar.memberDescription", { department: user.departmentName, timezone: user.timezoneName })
        }
      />
      <Card>
        {query.isError && (
          <ErrorState
            message={localizedError(t, query.error)}
            onRetry={() => void query.refetch()}
          />
        )}
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locales={[thLocale]}
          initialDate={isDemoMode ? "2026-08-03" : undefined}
          locale={i18n.resolvedLanguage === "en" ? "en" : "th"}
          timeZone="UTC"
          height="auto"
          dayMaxEvents
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth",
          }}
          buttonText={{ today: t("calendar.today"), month: t("calendar.month") }}
          events={events}
          datesSet={(info) => {
            const next = {
              start: info.startStr.slice(0, 10),
              end: info.endStr.slice(0, 10),
            };
            setRange((current) =>
              current.start === next.start && current.end === next.end
                ? current
                : next,
            );
          }}
          eventClick={(info) =>
            setSelected(info.event.extendedProps.booking as Booking)
          }
        />
      </Card>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={t("calendar.details")}
        footer={
          selected &&
          (user.roleCode === "admin" ||
            selected.bookedForProfileId === user.profileId) ? (
            <Button onClick={() => navigate("/bookings")}>{t("calendar.goToEdit")}</Button>
          ) : undefined
        }
      >
        {selected && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-[#667085]">{t("calendar.employee")}</dt>
            <dd className="font-semibold">{selected.bookedForName}</dd>
            <dt className="text-[#667085]">{t("calendar.department")}</dt>
            <dd>
              {selected.departmentCode} · {selected.departmentName}
            </dd>
            <dt className="text-[#667085]">{t("calendar.start")}</dt>
            <dd>
              {formatDateTime(selected.startAt, selected.businessTimezone)}
            </dd>
            <dt className="text-[#667085]">{t("calendar.end")}</dt>
            <dd>
              {formatDateTime(selected.endAt, selected.businessTimezone)}
            </dd>
            <dt className="text-[#667085]">{t("calendar.bookingTimezone")}</dt>
            <dd>{selected.businessTimezone}</dd>
            <dt className="text-[#667085]">{t("calendar.status")}</dt>
            <dd>{bookingStatusLabel(t, selected.statusCode)}</dd>
            <dt className="text-[#667085]">{t("calendar.notes")}</dt>
            <dd>{selected.noteText || "-"}</dd>
          </dl>
        )}
      </Dialog>
    </>
  );
}
