import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
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
    bookedForProfileId: z.string().min(1, "กรุณาเลือกพนักงาน"),
    bookingMode: z.enum(["single_day", "date_time_range"]),
    singleDate: z.string(),
    startDate: z.string(),
    startTime: z.string(),
    endDate: z.string(),
    endTime: z.string(),
    noteText: z.string().max(2000, "หมายเหตุต้องไม่เกิน 2,000 ตัวอักษร"),
  })
  .superRefine((value, context) => {
    if (value.bookingMode === "single_day" && !value.singleDate)
      context.addIssue({
        code: "custom",
        path: ["singleDate"],
        message: "กรุณาเลือกวันที่",
      });
    if (value.bookingMode === "date_time_range") {
      if (!value.startDate || !value.startTime)
        context.addIssue({
          code: "custom",
          path: ["startDate"],
          message: "กรุณาระบุวันและเวลาเริ่ม",
        });
      if (!value.endDate || !value.endTime)
        context.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "กรุณาระบุวันและเวลาสิ้นสุด",
        });
      if (
        value.startDate &&
        value.startTime &&
        value.endDate &&
        value.endTime &&
        localDateTimeToIso(value.endDate, value.endTime) <=
          localDateTimeToIso(value.startDate, value.startTime)
      )
        context.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม",
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

const emptyDefaults = (userId: string): BookingFormValues => ({
  bookedForProfileId: userId,
  bookingMode: "single_day",
  singleDate: todayBusinessDate(),
  startDate: todayBusinessDate(),
  startTime: "09:00",
  endDate: todayBusinessDate(),
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
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, setPending] = useState<BookingPayload | null>(null);
  const [holidayNames, setHolidayNames] = useState<string[]>([]);
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults(user.profileId),
  });
  const mode = form.watch("bookingMode");
  const selectedId = form.watch("bookedForProfileId");
  const selected =
    profiles.find((profile) => profile.profileId === selectedId) ??
    (user.profileId === selectedId ? user : null);

  useEffect(() => {
    if (!editing) {
      form.reset(emptyDefaults(user.profileId));
      return;
    }
    const start = dayjs(editing.startAt).tz("Asia/Bangkok");
    const end = dayjs(editing.endAt).tz("Asia/Bangkok");
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
  }, [editing, form, user.profileId]);

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
          actionReason: editing ? "แก้ไขผ่านหน้าจอ CoDesk" : undefined,
        }
      : {
          bookedForProfileId: values.bookedForProfileId,
          bookingMode: values.bookingMode,
          bookingDateStart: null,
          startAt: localDateTimeToIso(values.startDate, values.startTime),
          endAt: localDateTimeToIso(values.endDate, values.endTime),
          holidayWarningAcknowledged: acknowledged,
          noteText: values.noteText,
          actionReason: editing ? "แก้ไขผ่านหน้าจอ CoDesk" : undefined,
        };

  const submit = async (values: BookingFormValues) => {
    setWarning(null);
    const payload = toPayload(values);
    try {
      const result = await onValidate(payload);
      if (result.conflict.hasConflict) {
        setWarning("ช่วงเวลานี้ซ้อนกับรายการจองเดิมของพนักงาน");
        return;
      }
      if (!result.capacity.isAvailable) {
        setWarning("จำนวนผู้จองเกินความจุของฝ่ายในอย่างน้อยหนึ่งวัน");
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
      form.reset(emptyDefaults(user.profileId));
    } catch (caught) {
      setWarning(
        caught instanceof Error
          ? caught.message
          : "ไม่สามารถบันทึกรายการจองได้",
      );
    }
  };
  const confirmHoliday = async () => {
    if (!pending) return;
    try {
      await onSave({ ...pending, holidayWarningAcknowledged: true });
      setPending(null);
      form.reset(emptyDefaults(user.profileId));
    } catch (caught) {
      setWarning(
        caught instanceof Error
          ? caught.message
          : "ไม่สามารถบันทึกรายการจองได้",
      );
    }
  };
  const reset = () => {
    form.reset(emptyDefaults(user.profileId));
    setWarning(null);
  };

  return (
    <>
      <form
        aria-label="แบบฟอร์มจองเข้าออฟฟิศ"
        className="space-y-4"
        onSubmit={(event) => void form.handleSubmit(submit)(event)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="field-label">รูปแบบการจอง</span>
            <select className="field-input" {...form.register("bookingMode")}>
              <option value="single_day">รายวัน (เต็มวัน)</option>
              <option value="date_time_range">ช่วงวันและเวลา</option>
            </select>
          </label>
          <label>
            <span className="field-label">พนักงาน</span>
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
              {form.formState.errors.bookedForProfileId?.message}
            </p>
          </label>
        </div>
        <div className="rounded-xl bg-[#f8f9fc] p-3 text-sm">
          <span className="text-[#667085]">ฝ่ายงาน: </span>
          <strong>
            {selected?.departmentCode} · {selected?.departmentName}
          </strong>
        </div>
        {mode === "single_day" ? (
          <label>
            <span className="field-label">วันที่</span>
            <input
              aria-label="วันที่จอง"
              type="date"
              className="field-input"
              {...form.register("singleDate")}
            />
            <p className="field-error">
              {form.formState.errors.singleDate?.message}
            </p>
          </label>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="field-label">เริ่มต้น</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="วันที่เริ่ม"
                  type="date"
                  className="field-input"
                  {...form.register("startDate")}
                />
                <input
                  aria-label="เวลาเริ่ม"
                  type="time"
                  step="60"
                  className="field-input"
                  {...form.register("startTime")}
                />
              </div>
              <p className="field-error">
                {form.formState.errors.startDate?.message}
              </p>
            </div>
            <div>
              <span className="field-label">สิ้นสุด</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="วันที่สิ้นสุด"
                  type="date"
                  className="field-input"
                  {...form.register("endDate")}
                />
                <input
                  aria-label="เวลาสิ้นสุด"
                  type="time"
                  step="60"
                  className="field-input"
                  {...form.register("endTime")}
                />
              </div>
              <p className="field-error">
                {form.formState.errors.endDate?.message}
              </p>
            </div>
          </div>
        )}
        <label>
          <span className="field-label">หมายเหตุ</span>
          <textarea
            className="field-input min-h-24"
            {...form.register("noteText")}
          />
          <p className="field-error">
            {form.formState.errors.noteText?.message}
          </p>
        </label>
        {(warning || serverError) && (
          <div
            role="alert"
            className="rounded-xl border border-[#fecdca] bg-[#fef3f2] p-3 text-sm text-[#b42318]"
          >
            {warning ?? serverError}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving
              ? "กำลังบันทึก…"
              : editing
                ? "บันทึกการแก้ไข"
                : "บันทึกการจอง"}
          </Button>
          <Button variant="secondary" onClick={reset}>
            ล้างค่า
          </Button>
        </div>
      </form>
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="วันที่เลือกตรงกับวันหยุด"
        description="ระบบอนุญาตให้จองได้ แต่ต้องยืนยันว่ารับทราบวันหยุด"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              กลับไปแก้ไข
            </Button>
            <Button onClick={() => void confirmHoliday()}>
              ยืนยันและบันทึก
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
            {warning}
          </p>
        )}
      </Dialog>
    </>
  );
}
