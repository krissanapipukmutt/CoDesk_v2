import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, isDemoMode, toQuery } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { ErrorState } from "../components/Feedback";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import type { Booking, PageResult } from "../types";
import { formatDateTime } from "../utils/date";

export function CalendarPage() {
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
          : booking.startAt,
      end: booking.bookingMode === "single_day" ? undefined : booking.endAt,
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
        title="ปฏิทินการเข้าออฟฟิศ"
        description={
          user.roleCode === "admin"
            ? "แสดงรายการจองทุกฝ่าย"
            : `แสดงสมาชิกใน ${user.departmentName}`
        }
      />
      <Card>
        {query.isError && (
          <ErrorState
            message={query.error.message}
            onRetry={() => void query.refetch()}
          />
        )}
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={isDemoMode ? "2026-08-03" : undefined}
          locale="th"
          timeZone="Asia/Bangkok"
          height="auto"
          dayMaxEvents
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth",
          }}
          buttonText={{ today: "วันนี้", month: "เดือน" }}
          events={events}
          datesSet={(info) =>
            setRange({
              start: info.startStr.slice(0, 10),
              end: info.endStr.slice(0, 10),
            })
          }
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
        title="รายละเอียดการจอง"
        footer={
          selected &&
          (user.roleCode === "admin" ||
            selected.bookedForProfileId === user.profileId) ? (
            <Button onClick={() => navigate("/bookings")}>ไปหน้าแก้ไข</Button>
          ) : undefined
        }
      >
        {selected && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-[#667085]">พนักงาน</dt>
            <dd className="font-semibold">{selected.bookedForName}</dd>
            <dt className="text-[#667085]">ฝ่าย</dt>
            <dd>
              {selected.departmentCode} · {selected.departmentName}
            </dd>
            <dt className="text-[#667085]">เริ่ม</dt>
            <dd>{formatDateTime(selected.startAt)}</dd>
            <dt className="text-[#667085]">สิ้นสุด</dt>
            <dd>{formatDateTime(selected.endAt)}</dd>
            <dt className="text-[#667085]">สถานะ</dt>
            <dd>{selected.statusCode === "booked" ? "จองแล้ว" : "ยกเลิก"}</dd>
            <dt className="text-[#667085]">หมายเหตุ</dt>
            <dd>{selected.noteText || "-"}</dd>
          </dl>
        )}
      </Dialog>
    </>
  );
}
