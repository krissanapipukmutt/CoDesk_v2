import type { TFunction } from "i18next";
import { ApiError } from "../api/client";
import type { BookingMode, BookingStatus, RoleCode } from "../types";

export const roleLabel = (t: TFunction, code: RoleCode) => t(`roles.${code}`);
export const bookingStatusLabel = (t: TFunction, code: BookingStatus) => t(`status.${code}`);
export const bookingModeLabel = (t: TFunction, code: BookingMode) => t(`status.${code}`);
export const capacityModeLabel = (t: TFunction, code: "limited" | "unlimited") => t(`status.${code}`);

export function localizedError(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    const code = error.problem.code;
    if (code && i18nErrorCodes.has(code)) return t(`errors.${code}`);
    if (error.status === 400) return t("errors.validation");
    if (error.status === 401) return t("errors.unauthorized");
    if (error.status === 403) return t("errors.forbidden");
    if (error.status === 404) return t("errors.notFound");
    if (error.status === 409) return t("errors.conflict");
    if (error.status === 503) return t("errors.unavailable");
  }
  return t("errors.generic");
}

const i18nErrorCodes = new Set([
  "invalid_profile", "validation_error", "holiday_confirmation_required", "booking_conflict",
  "capacity_exceeded", "invalid_status", "invalid_department", "already_cancelled",
]);
