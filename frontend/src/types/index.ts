export type RoleCode = "employee" | "hr" | "admin";
export type BookingMode = "single_day" | "date_time_range";
export type BookingStatus = "booked" | "cancelled";

export interface Profile {
  profileId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  roleId: string;
  roleCode: RoleCode;
  roleName: string;
  isActive: boolean;
  timezoneName: string;
  departmentTimezone: string;
  canManageUsers: boolean;
  canManageDepartments: boolean;
  canViewReports: boolean;
}
export type CurrentUser = Omit<Profile, "roleId">;
export interface Department {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  capacityMode: "limited" | "unlimited";
  defaultCapacityPerDay: number | null;
  isActive: boolean;
  effectiveTimezone: string;
  createdAt: string;
  updatedAt: string;
}
export interface Holiday {
  holidayId: string;
  holidayDate: string;
  holidayName: string;
  holidayDescription: string | null;
  isActive: boolean;
  createdByProfileId: string;
  createdAt: string;
  updatedAt: string;
}
export interface Booking {
  bookingId: string;
  bookedForProfileId: string;
  bookedForEmployeeCode: string;
  bookedForName: string;
  bookedByProfileId: string;
  bookedByName: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  businessTimezone: string;
  bookingMode: BookingMode;
  bookingDateStart: string;
  bookingDateEnd: string;
  startAt: string;
  endAt: string;
  holidayWarningAcknowledged: boolean;
  statusCode: BookingStatus;
  noteText: string | null;
  cancelledAt: string | null;
  cancelledByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface ReportPage {
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
}
export interface BookingValidation {
  conflict: { hasConflict: boolean; conflictingBookingId?: string };
  capacity: {
    isAvailable: boolean;
    dates: Array<{
      date: string;
      capacityMode: string;
      capacity: number | null;
      currentCount: number;
      projectedCount: number;
      exceeded: boolean;
    }>;
  };
  holidays: {
    hasHolidays: boolean;
    holidays: Array<{
      holiday_id: string;
      holiday_date: string;
      holiday_name: string;
      holiday_description?: string;
    }>;
  };
}
export interface ApiProblem {
  status?: number;
  title?: string;
  detail?: string;
  code?: string;
  details?: unknown;
  requestId?: string;
}
export interface DepartmentHistory {
  historyId: string;
  profileId: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  assignedStartDate: string;
  assignedEndDate: string | null;
  assignedByProfileId: string;
  assignedByName: string;
  noteText: string | null;
}
export interface Role {
  roleId: string;
  roleCode: RoleCode;
  roleName: string;
  canManageUsers: boolean;
  canManageDepartments: boolean;
  canViewReports: boolean;
}
