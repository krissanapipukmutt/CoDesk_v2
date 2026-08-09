import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { bookingModeLabel, bookingStatusLabel, localizedError } from "../i18n/format";
import { formatDateTime } from "../utils/date";

export function BookingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const client = useQueryClient();
  const [editing, setEditing] = useState<Booking | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
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
      setMessage(editing ? "booking.updated" : "booking.created");
      setEditing(null);
      setError(null);
      await client.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (caught: Error) => setError(caught),
  });
  const cancel = useMutation({
    mutationFn: (bookingId: string) =>
      apiFetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: t("booking.cancelReason") }),
      }),
    onSuccess: async () => {
      setMessage("booking.cancelled");
      await client.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (caught: Error) => setError(caught),
  });
  if (!user) return null;
  const availableProfiles = profiles.data?.items ?? [
    { ...user, roleId: "" } as Profile,
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
        title={t("booking.pageTitle")}
        description={t("booking.pageDescription")}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,.8fr)]">
        <Card>
          <h2 className="mb-4 font-bold">
            {editing
              ? t("booking.editTitle", { id: editing.bookingId.slice(0, 8) })
              : t("booking.createTitle")}
          </h2>
          {profiles.isError && user.roleCode === "admin" && (
            <ErrorState
              message={`${t("booking.loadProfilesFailed")}: ${localizedError(t, profiles.error)}`}
              onRetry={() => void profiles.refetch()}
            />
          )}
          {message && (
            <div className="mb-4 rounded-xl bg-[#ecfdf3] p-3 text-sm text-[#067647]">
              {t(message)}
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
            serverError={error ? localizedError(t, error) : null}
          />
        </Card>
        <Card>
          <h2 className="mb-4 font-bold">{t("booking.listTitle")}</h2>
          {bookings.isLoading ? (
            <LoadingState />
          ) : bookings.isError ? (
            <ErrorState
              message={localizedError(t, bookings.error)}
              onRetry={() => void bookings.refetch()}
            />
          ) : !bookings.data?.items.length ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {bookings.data.items.map((booking) => (
                <div
                  key={booking.bookingId}
                  aria-label={t("booking.itemLabel", { id: booking.bookingId })}
                  className="rounded-xl border border-[#e4e8f0] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">
                        {booking.bookedForName}
                      </div>
                      <div className="mt-1 text-sm text-[#667085]">
                        {formatDateTime(
                          booking.startAt,
                          booking.businessTimezone,
                        )}{" "}
                        –{" "}
                        {formatDateTime(
                          booking.endAt,
                          booking.businessTimezone,
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[#667085]">
                        {booking.departmentCode} · {booking.businessTimezone} ·{" "}
                        {bookingModeLabel(t, booking.bookingMode)}
                      </div>
                    </div>
                    <span
                      className={`status-pill ${booking.statusCode === "booked" ? "status-active" : "status-inactive"}`}
                    >
                      {bookingStatusLabel(t, booking.statusCode)}
                    </span>
                  </div>
                  {booking.statusCode === "booked" && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditing(booking)}
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          if (window.confirm(t("booking.cancelConfirm")))
                            cancel.mutate(booking.bookingId);
                        }}
                      >
                        {t("common.cancel")}
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
