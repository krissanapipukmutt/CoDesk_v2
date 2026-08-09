import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch, toQuery } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Pagination } from "../components/Pagination";
import { Card, PageHeader } from "../components/ui/Card";
import type { Department, PageResult, ReportPage } from "../types";
import { localizedError } from "../i18n/format";

type Row = Record<string, unknown>;
interface Definition {
  code: string;
  title: string;
  columns: Array<{ key: string; label: string }>;
}
const reportShape = [
  {
    code: "daily-department-bookings",
    titleKey: "daily",
    columns: ["business_date", "department_code", "department_name", "active_booking_total"],
  },
  {
    code: "department-capacity-utilization",
    titleKey: "capacity",
    columns: ["business_date", "department_code", "department_name", "capacity_mode", "capacity_per_day", "booked_count", "remaining_capacity", "utilization_percentage"],
  },
  {
    code: "employee-booking-frequency",
    titleKey: "frequency",
    columns: ["employee_code", "full_name", "department_name", "total_bookings", "active_bookings", "cancelled_bookings", "first_booking_date", "last_booking_date"],
  },
  {
    code: "holiday-bookings",
    titleKey: "holiday",
    columns: ["holiday_date", "holiday_name", "employee_code", "full_name", "department_name", "booking_mode", "holiday_warning_acknowledged", "status_code"],
  },
  {
    code: "booking-cancellations",
    titleKey: "cancellations",
    columns: ["cancellation_date", "employee_code", "full_name", "department_name", "cancelled_by_name", "action_reason", "department_daily_cancellation_total"],
  },
] as const;

const buildReports = (t: TFunction): Definition[] => reportShape.map((report) => ({
  code: report.code,
  title: t(`reports.definitions.${report.titleKey}.title`),
  columns: report.columns.map((key) => ({ key, label: t(`reports.columns.${key}`) })),
}));

export function ReportsPage() {
  const { t } = useTranslation();
  const reports = useMemo(() => buildReports(t), [t]);
  const [activeCode, setActiveCode] = useState<string>(reportShape[0].code);
  const active = reports.find((report) => report.code === activeCode) ?? reports[0];
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: reportShape[0].columns[0],
    direction: "asc",
  });
  const departments = useQuery({
    queryKey: ["report-departments"],
    queryFn: () =>
      apiFetch<PageResult<Department>>(
        "/api/departments" + toQuery({ pageSize: 100 }),
      ),
  });
  const serializedFilters = JSON.stringify(filters);
  const query = useQuery({
    queryKey: [
      "report",
      active.code,
      serializedFilters,
      dateFrom,
      dateTo,
      departmentId,
      page,
      sort,
    ],
    queryFn: () =>
      apiFetch<ReportPage>(
        `/api/reports/${active.code}` +
          toQuery({
            filters: serializedFilters,
            dateFrom,
            dateTo,
            departmentId,
            page,
            pageSize: 20,
            sortBy: sort.key,
            sortDirection: sort.direction,
          }),
      ),
  });
  const selectReport = (definition: Definition) => {
    setActiveCode(definition.code);
    setFilters({});
    setPage(1);
    setSort({ key: definition.columns[0].key, direction: "asc" });
  };
  return (
    <>
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
      />
      <div className="mb-4 flex gap-2 overflow-auto pb-1">
        {reports.map((report) => (
          <button
            key={report.code}
            onClick={() => selectReport(report)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${active.code === report.code ? "bg-[#3157d5] text-white" : "border border-[#d0d5dd] bg-white text-[#475467]"}`}
          >
            {report.title}
          </button>
        ))}
      </div>
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <label>
            <span className="field-label">{t("reports.from")}</span>
            <input
              type="date"
              className="field-input"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            <span className="field-label">{t("reports.to")}</span>
            <input
              type="date"
              className="field-input"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            <span className="field-label">{t("reports.department")}</span>
            <select
              className="field-input"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("common.allDepartments")}</option>
              {departments.data?.items.map((department) => (
                <option
                  key={department.departmentId}
                  value={department.departmentId}
                >
                  {department.departmentCode} · {department.departmentName}
                </option>
              ))}
            </select>
          </label>
        </div>
        {active.code === "department-capacity-utilization" &&
        query.data?.items.length ? (
          <ReportChart rows={query.data!.items} />
        ) : null}
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState message={localizedError(t, query.error)} />
        ) : !query.data?.items.length ? (
          <EmptyState message={t("reports.empty")} />
        ) : (
          <>
            <ReportTable
              definition={active}
              rows={query.data!.items}
              filters={filters}
              onFilter={(key, value) => {
                setFilters((current) => ({ ...current, [key]: value }));
                setPage(1);
              }}
              sort={sort}
              onSort={(key) =>
                setSort((current) => ({
                  key,
                  direction:
                    current.key === key && current.direction === "asc"
                      ? "desc"
                      : "asc",
                }))
              }
            />
            <Pagination
              page={page}
              pageSize={20}
              total={query.data!.total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}

function ReportTable({
  definition,
  rows,
  filters,
  onFilter,
  sort,
  onSort,
}: {
  definition: Definition;
  rows: Row[];
  filters: Record<string, string>;
  onFilter: (key: string, value: string) => void;
  sort: { key: string; direction: "asc" | "desc" };
  onSort: (key: string) => void;
}) {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      definition.columns.map((column) => ({
        id: column.key,
        accessorFn: (row) => row[column.key],
        header: () => (
          <button
            className="flex items-center gap-1"
            onClick={() => onSort(column.key)}
          >
            {column.label}
            {sort.key === column.key &&
              (sort.direction === "asc" ? (
                <ChevronUp size={13} />
              ) : (
                <ChevronDown size={13} />
              ))}
          </button>
        ),
        cell: (context) => formatValue(context.getValue(), column.key, t),
      })),
    [definition, onSort, sort, t],
  );
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                  <input
                    aria-label={t("reports.filterLabel", { column: header.id })}
                    className="mt-2 w-full min-w-24 rounded border border-[#d0d5dd] bg-white px-2 py-1 text-xs font-normal"
                    value={filters[header.id] ?? ""}
                    onChange={(event) =>
                      onFilter(header.id, event.target.value)
                    }
                    placeholder={t("reports.filterPlaceholder")}
                  />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function formatValue(value: unknown, key: string, t: TFunction) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? t("common.yes") : t("common.no");
  if (key === "capacity_mode" && (value === "limited" || value === "unlimited")) return t(`status.${value}`);
  if (key === "booking_mode" && (value === "single_day" || value === "date_time_range")) return t(`status.${value}`);
  if (key === "status_code" && (value === "booked" || value === "cancelled")) return t(`status.${value}`);
  return String(value);
}
function ReportChart({ rows }: { rows: Row[] }) {
  const { t } = useTranslation();
  const data = rows
    .slice(0, 12)
    .map((row) => ({
      name: `${String(row.business_date ?? "")} ${String(row.department_code ?? "")}`,
      booked: Number(row.booked_count ?? 0),
      capacity: Number(row.capacity_per_day ?? 0),
    }));
  return (
    <div className="mb-5 h-72 rounded-xl border border-[#e4e8f0] p-3">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <BarChart3 size={18} className="text-[#3157d5]" />
        {t("reports.chartTitle")}
      </div>
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" hide />
          <YAxis />
          <Tooltip />
          <Bar dataKey="capacity" fill="#c7d7fe" name={t("reports.chartCapacity")} />
          <Bar dataKey="booked" fill="#3157d5" name={t("reports.chartBooked")} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
