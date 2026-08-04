import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, toQuery } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import {
  BookingForm,
  type BookingPayload,
} from "../features/bookings/BookingForm";
import type { Booking, BookingValidation, PageResult, Profile } from "../types";
import { formatDateTime } from "../utils/date";

export function BookingsPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [editing, setEditing] = useState<Booking | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const profiles = useQuery({
    queryKey: ["profiles-active"],
    queryFn: () =>
      apiFetch<PageResult<Profile>>(
        "/api/profiles" + toQuery({ pageSize: 100 }),
      ),
  });
  const bookings = useQuery({
    queryKey: ["bookings"],
    queryFn: () =>
      apiFetch<PageResult<Booking>>(
        "/api/bookings" + toQuery({ pageSize: 100 }),
      ),
  });
  const save = useMutation({
    mutationFn: (payload: BookingPayload) =>
      apiFetch(
        editing ? `/api/bookings/${editing.bookingId}` : "/api/bookings",
        { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) },
      ),
    onSuccess: async () => {
      setMessage(editing ? "แก้ไขรายการจองสำเร็จ" : "บันทึกรายการจองสำเร็จ");
      setEditing(null);
      setError(null);
      await client.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (caught: Error) => setError(caught.message),
  });
  const cancel = useMutation({
    mutationFn: (bookingId: string) =>
      apiFetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "ยกเลิกผ่านหน้าจอ CoDesk" }),
      }),
    onSuccess: async () => {
      setMessage("ยกเลิกรายการจองแล้ว");
      await client.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (caught: Error) => setError(caught.message),
  });
  if (!user) return null;
  const availableProfiles = profiles.data?.items ?? [
    { ...user, roleId: "", timezoneName: "Asia/Bangkok" } as Profile,
  ];
  const validate = (payload: BookingPayload) =>
    apiFetch<BookingValidation>(
      "/api/bookings/validate" +
        toQuery({ excludeBookingId: editing?.bookingId }),
      { method: "POST", body: JSON.stringify(payload) },
    );
  return (
    <>
      <PageHeader
        title="จองเข้าออฟฟิศ"
        description="รองรับการจองเต็มวัน ช่วงเวลา ข้ามวัน และวันหยุด"
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,.8fr)]">
        <Card>
          <h2 className="mb-4 font-bold">
            {editing
              ? `แก้ไขรายการ ${editing.bookingId.slice(0, 8)}`
              : "สร้างรายการจอง"}
          </h2>
          {profiles.isError && user.roleCode === "admin" && (
            <ErrorState
              message={`ไม่สามารถโหลดรายชื่อพนักงาน: ${profiles.error.message}`}
              onRetry={() => void profiles.refetch()}
            />
          )}
          {message && (
            <div className="mb-4 rounded-xl bg-[#ecfdf3] p-3 text-sm text-[#067647]">
              {message}
            </div>
          )}
          <BookingForm
            user={user}
            profiles={availableProfiles}
            editing={editing}
            onValidate={validate}
            onSave={async (payload) => {
              await save.mutateAsync(payload);
            }}
            saving={save.isPending}
            serverError={error}
          />
        </Card>
        <Card>
          <h2 className="mb-4 font-bold">รายการจอง</h2>
          {bookings.isLoading ? (
            <LoadingState />
          ) : bookings.isError ? (
            <ErrorState
              message={bookings.error.message}
              onRetry={() => void bookings.refetch()}
            />
          ) : !bookings.data?.items.length ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {bookings.data.items.map((booking) => (
                <div
                  key={booking.bookingId}
                  aria-label={`รายการจอง ${booking.bookingId}`}
                  className="rounded-xl border border-[#e4e8f0] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">
                        {booking.bookedForName}
                      </div>
                      <div className="mt-1 text-sm text-[#667085]">
                        {formatDateTime(booking.startAt)} –{" "}
                        {formatDateTime(booking.endAt)}
                      </div>
                      <div className="mt-1 text-xs text-[#667085]">
                        {booking.departmentCode} ·{" "}
                        {booking.bookingMode === "single_day"
                          ? "เต็มวัน"
                          : "ช่วงเวลา"}
                      </div>
                    </div>
                    <span
                      className={`status-pill ${booking.statusCode === "booked" ? "status-active" : "status-inactive"}`}
                    >
                      {booking.statusCode === "booked" ? "จองแล้ว" : "ยกเลิก"}
                    </span>
                  </div>
                  {booking.statusCode === "booked" && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditing(booking)}
                      >
                        แก้ไข
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          if (window.confirm("ยืนยันการยกเลิกรายการนี้?"))
                            cancel.mutate(booking.bookingId);
                        }}
                      >
                        ยกเลิก
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
