import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { localizedError } from "../../i18n/format";
import type {
  Booking,
  BookingMode,
  BookingValidation,
  CurrentUser,
  Profile,
} from "../../types";
import { localDateTimeToIso, todayBusinessDate } from "../../utils/date";

const schema = z
  .object({
    bookedForProfileId: z.string().min(1, "booking.validation.employee"),
    bookingMode: z.enum(["single_day", "date_time_range"]),
    singleDate: z.string(),
    startDate: z.string(),
    startTime: z.string(),
    endDate: z.string(),
    endTime: z.string(),
    noteText: z.string().max(2000, "booking.validation.notes"),
  })
  .superRefine((value, context) => {
    if (value.bookingMode === "single_day" && !value.singleDate)
      context.addIssue({
        code: "custom",
        path: ["singleDate"],
        message: "booking.validation.date",
      });
    if (value.bookingMode === "date_time_range") {
      if (!value.startDate || !value.startTime)
        context.addIssue({
          code: "custom",
          path: ["startDate"],
          message: "booking.validation.start",
        });
      if (!value.endDate || !value.endTime)
        context.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "booking.validation.end",
        });
      if (
        value.startDate &&
        value.startTime &&
        value.endDate &&
        value.endTime &&
        `${value.endDate}T${value.endTime}` <=
          `${value.startDate}T${value.startTime}`
      )
        context.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "booking.validation.range",
        });
    }
  });
export type BookingFormValues = z.infer<typeof schema>;
export interface BookingPayload {
  bookedForProfileId: string;
  bookingMode: BookingMode;
  bookingDateStart: string | null;
  startAt: string | null;
  endAt: string | null;
  holidayWarningAcknowledged: boolean;
  noteText: string;
  actionReason?: string;
}

const emptyDefaults = (
  userId: string,
  timezoneName: string,
): BookingFormValues => ({
  bookedForProfileId: userId,
  bookingMode: "single_day",
  singleDate: todayBusinessDate(timezoneName),
  startDate: todayBusinessDate(timezoneName),
  startTime: "09:00",
  endDate: todayBusinessDate(timezoneName),
  endTime: "17:00",
  noteText: "",
});

export function BookingForm({
  user,
  profiles,
  editing,
  onValidate,
  onSave,
  saving = false,
  serverError,
}: {
  user: CurrentUser;
  profiles: Profile[];
  editing?: Booking | null;
  onValidate: (payload: BookingPayload) => Promise<BookingValidation>;
  onSave: (payload: BookingPayload) => Promise<void>;
  saving?: boolean;
  serverError?: string | null;
}) {
  const { t } = useTranslation();
  const [warning, setWarning] = useState<{ key?: string; error?: unknown } | null>(null);
  const [pending, setPending] = useState<BookingPayload | null>(null);
  const [holidayNames, setHolidayNames] = useState<string[]>([]);
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults(user.profileId, user.departmentTimezone),
  });
  const mode = form.watch("bookingMode");
  const selectedId = form.watch("bookedForProfileId");
  const selected =
    profiles.find((profile) => profile.profileId === selectedId) ??
    (user.profileId === selectedId ? user : null);
  const selectedTimezone =
    selected?.departmentTimezone ?? user.departmentTimezone;
  const editingTimezone =
    profiles.find((profile) => profile.profileId === editing?.bookedForProfileId)
      ?.departmentTimezone ??
    editing?.businessTimezone ??
    user.departmentTimezone;

  useEffect(() => {
    if (!editing) {
      form.reset(emptyDefaults(user.profileId, user.departmentTimezone));
      return;
    }
    const start = dayjs(editing.startAt).tz(editingTimezone);
    const end = dayjs(editing.endAt).tz(editingTimezone);
    form.reset({
      bookedForProfileId: editing.bookedForProfileId,
      bookingMode: editing.bookingMode,
      singleDate: editing.bookingDateStart,
      startDate: start.format("YYYY-MM-DD"),
      startTime: start.format("HH:mm"),
      endDate: end.format("YYYY-MM-DD"),
      endTime: end.format("HH:mm"),
      noteText: editing.noteText ?? "",
    });
  }, [editing, editingTimezone, form, user.departmentTimezone, user.profileId]);

  const toPayload = (
    values: BookingFormValues,
    acknowledged = false,
  ): BookingPayload =>
    values.bookingMode === "single_day"
      ? {
          bookedForProfileId: values.bookedForProfileId,
          bookingMode: values.bookingMode,
          bookingDateStart: values.singleDate,
          startAt: null,
          endAt: null,
          holidayWarningAcknowledged: acknowledged,
          noteText: values.noteText,
          actionReason: editing ? t("booking.updateReason") : undefined,
        }
      : {
          bookedForProfileId: values.bookedForProfileId,
          bookingMode: values.bookingMode,
          bookingDateStart: null,
          startAt: localDateTimeToIso(
            values.startDate,
            values.startTime,
            selectedTimezone,
          ),
          endAt: localDateTimeToIso(
            values.endDate,
            values.endTime,
            selectedTimezone,
          ),
          holidayWarningAcknowledged: acknowledged,
          noteText: values.noteText,
          actionReason: editing ? t("booking.updateReason") : undefined,
        };

  const submit = async (values: BookingFormValues) => {
    setWarning(null);
    try {
      const payload = toPayload(values);
      const result = await onValidate(payload);
      if (result.conflict.hasConflict) {
        setWarning({ key: "errors.booking_conflict" });
        return;
      }
      if (!result.capacity.isAvailable) {
        setWarning({ key: "errors.capacity_exceeded" });
        return;
      }
      if (result.holidays.hasHolidays) {
        setPending(payload);
        setHolidayNames(
          result.holidays.holidays.map(
            (holiday) => `${holiday.holiday_date} · ${holiday.holiday_name}`,
          ),
        );
        return;
      }
      await onSave(payload);
      form.reset(emptyDefaults(user.profileId, user.departmentTimezone));
    } catch (caught) {
      setWarning(
        caught instanceof RangeError && caught.message === "invalid_local_time"
          ? { key: "booking.validation.localTime" }
          : { error: caught },
      );
    }
  };
  const confirmHoliday = async () => {
    if (!pending) return;
    try {
      await onSave({ ...pending, holidayWarningAcknowledged: true });
      setPending(null);
      form.reset(emptyDefaults(user.profileId, user.departmentTimezone));
    } catch (caught) {
      setWarning({ error: caught });
    }
  };
  const reset = () => {
    form.reset(emptyDefaults(user.profileId, user.departmentTimezone));
    setWarning(null);
  };

  return (
    <>
      <form
        aria-label={t("booking.formLabel")}
        className="space-y-4"
        onSubmit={(event) => void form.handleSubmit(submit)(event)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="field-label">{t("booking.mode")}</span>
            <select className="field-input" {...form.register("bookingMode")}>
              <option value="single_day">{t("booking.modeSingle")}</option>
              <option value="date_time_range">{t("booking.modeRange")}</option>
            </select>
          </label>
          <label>
            <span className="field-label">{t("booking.employee")}</span>
            {user.roleCode === "admin" ? (
              <select
                className="field-input"
                {...form.register("bookedForProfileId")}
              >
                {profiles
                  .filter((profile) => profile.isActive)
                  .map((profile) => (
                    <option key={profile.profileId} value={profile.profileId}>
                      {profile.employeeCode} · {profile.fullName}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                className="field-input bg-[#f8f9fc]"
                value={`${user.employeeCode} · ${user.fullName}`}
                readOnly
              />
            )}
            <p className="field-error">
              {form.formState.errors.bookedForProfileId?.message
                ? t(form.formState.errors.bookedForProfileId.message)
                : null}
            </p>
          </label>
        </div>
        <div className="rounded-xl bg-[#f8f9fc] p-3 text-sm">
          <span className="text-[#667085]">{t("booking.department")} </span>
          <strong>
            {selected?.departmentCode} · {selected?.departmentName}
          </strong>
          <span className="ml-2 text-[#667085]">({selectedTimezone})</span>
        </div>
        {mode === "single_day" ? (
          <label>
            <span className="field-label">{t("booking.date")}</span>
            <input
              aria-label={t("booking.bookingDate")}
              type="date"
              className="field-input"
              {...form.register("singleDate")}
            />
            <p className="field-error">
              {form.formState.errors.singleDate?.message
                ? t(form.formState.errors.singleDate.message)
                : null}
            </p>
          </label>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="field-label">{t("booking.start")}</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label={t("booking.startDate")}
                  type="date"
                  className="field-input"
                  {...form.register("startDate")}
                />
                <input
                  aria-label={t("booking.startTime")}
                  type="time"
                  step="60"
                  className="field-input"
                  {...form.register("startTime")}
                />
              </div>
              <p className="field-error">
                {form.formState.errors.startDate?.message
                  ? t(form.formState.errors.startDate.message)
                  : null}
              </p>
            </div>
            <div>
              <span className="field-label">{t("booking.end")}</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label={t("booking.endDate")}
                  type="date"
                  className="field-input"
                  {...form.register("endDate")}
                />
                <input
                  aria-label={t("booking.endTime")}
                  type="time"
                  step="60"
                  className="field-input"
                  {...form.register("endTime")}
                />
              </div>
              <p className="field-error">
                {form.formState.errors.endDate?.message
                  ? t(form.formState.errors.endDate.message)
                  : null}
              </p>
            </div>
          </div>
        )}
        <label>
          <span className="field-label">{t("booking.notes")}</span>
          <textarea
            className="field-input min-h-24"
            {...form.register("noteText")}
          />
          <p className="field-error">
            {form.formState.errors.noteText?.message
              ? t(form.formState.errors.noteText.message)
              : null}
          </p>
        </label>
        {(warning || serverError) && (
          <div
            role="alert"
            className="rounded-xl border border-[#fecdca] bg-[#fef3f2] p-3 text-sm text-[#b42318]"
          >
            {warning
              ? warning.key
                ? t(warning.key)
                : localizedError(t, warning.error)
              : serverError}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving
              ? t("common.saving")
              : editing
                ? t("booking.update")
                : t("booking.create")}
          </Button>
          <Button variant="secondary" onClick={reset}>
            {t("common.reset")}
          </Button>
        </div>
      </form>
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={t("booking.holidayTitle")}
        description={t("booking.holidayDescription")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              {t("booking.holidayBack")}
            </Button>
            <Button onClick={() => void confirmHoliday()}>
              {t("booking.holidayConfirm")}
            </Button>
          </>
        }
      >
        <ul className="space-y-2">
          {holidayNames.map((name) => (
            <li
              key={name}
              className="rounded-lg bg-[#fffaeb] p-3 text-sm text-[#b54708]"
            >
              {name}
            </li>
          ))}
        </ul>
        {warning && (
          <p role="alert" className="mt-3 text-sm text-[#b42318]">
            {warning.key ? t(warning.key) : localizedError(t, warning.error)}
          </p>
        )}
      </Dialog>
    </>
  );
}
