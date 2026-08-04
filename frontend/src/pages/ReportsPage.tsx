import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
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

type Row = Record<string, unknown>;
interface Definition {
  code: string;
  title: string;
  columns: Array<{ key: string; label: string }>;
}
const reports: Definition[] = [
  {
    code: "daily-department-bookings",
    title: "ยอดจองรายวันแยกฝ่าย",
    columns: [
      { key: "business_date", label: "วันที่" },
      { key: "department_code", label: "รหัสฝ่าย" },
      { key: "department_name", label: "ฝ่าย" },
      { key: "active_booking_total", label: "ยอดจอง" },
    ],
  },
  {
    code: "department-capacity-utilization",
    title: "การใช้ความจุของฝ่าย",
    columns: [
      { key: "business_date", label: "วันที่" },
      { key: "department_code", label: "รหัสฝ่าย" },
      { key: "department_name", label: "ฝ่าย" },
      { key: "capacity_mode", label: "รูปแบบ" },
      { key: "capacity_per_day", label: "ความจุ" },
      { key: "booked_count", label: "จองแล้ว" },
      { key: "remaining_capacity", label: "คงเหลือ" },
      { key: "utilization_percentage", label: "ใช้ (%)" },
    ],
  },
  {
    code: "employee-booking-frequency",
    title: "ความถี่การจองของพนักงาน",
    columns: [
      { key: "employee_code", label: "รหัส" },
      { key: "full_name", label: "พนักงาน" },
      { key: "department_name", label: "ฝ่าย" },
      { key: "total_bookings", label: "ทั้งหมด" },
      { key: "active_bookings", label: "ใช้งาน" },
      { key: "cancelled_bookings", label: "ยกเลิก" },
      { key: "first_booking_date", label: "วันแรก" },
      { key: "last_booking_date", label: "วันล่าสุด" },
    ],
  },
  {
    code: "holiday-bookings",
    title: "การจองในวันหยุด",
    columns: [
      { key: "holiday_date", label: "วันหยุด" },
      { key: "holiday_name", label: "ชื่อวันหยุด" },
      { key: "employee_code", label: "รหัส" },
      { key: "full_name", label: "พนักงาน" },
      { key: "department_name", label: "ฝ่าย" },
      { key: "booking_mode", label: "รูปแบบจอง" },
      { key: "holiday_warning_acknowledged", label: "ยืนยันแล้ว" },
      { key: "status_code", label: "สถานะ" },
    ],
  },
  {
    code: "booking-cancellations",
    title: "สรุปการยกเลิก",
    columns: [
      { key: "cancellation_date", label: "วันที่ยกเลิก" },
      { key: "employee_code", label: "รหัส" },
      { key: "full_name", label: "พนักงาน" },
      { key: "department_name", label: "ฝ่าย" },
      { key: "cancelled_by_name", label: "ผู้ยกเลิก" },
      { key: "action_reason", label: "เหตุผล" },
      { key: "department_daily_cancellation_total", label: "ยอดยกเลิกรายวัน" },
    ],
  },
];

export function ReportsPage() {
  const [active, setActive] = useState(reports[0]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: reports[0].columns[0].key,
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
    setActive(definition);
    setFilters({});
    setPage(1);
    setSort({ key: definition.columns[0].key, direction: "asc" });
  };
  return (
    <>
      <PageHeader
        title="รายงาน"
        description="ข้อมูลจริงจาก PostgreSQL Views พร้อมตัวกรองรายคอลัมน์แบบตาราง Excel"
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
            <span className="field-label">ตั้งแต่วันที่</span>
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
            <span className="field-label">ถึงวันที่</span>
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
            <span className="field-label">ฝ่ายงาน</span>
            <select
              className="field-input"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">ทุกฝ่าย</option>
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
          <ErrorState message={query.error.message} />
        ) : !query.data?.items.length ? (
          <EmptyState message="ไม่พบข้อมูลรายงานตามเงื่อนไข" />
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
        cell: (context) => formatValue(context.getValue()),
      })),
    [definition, onSort, sort],
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
                    aria-label={`กรอง ${header.id}`}
                    className="mt-2 w-full min-w-24 rounded border border-[#d0d5dd] bg-white px-2 py-1 text-xs font-normal"
                    value={filters[header.id] ?? ""}
                    onChange={(event) =>
                      onFilter(header.id, event.target.value)
                    }
                    placeholder="กรอง…"
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
function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่";
  return String(value);
}
function ReportChart({ rows }: { rows: Row[] }) {
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
        จองแล้วเทียบความจุ
      </div>
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" hide />
          <YAxis />
          <Tooltip />
          <Bar dataKey="capacity" fill="#c7d7fe" name="ความจุ" />
          <Bar dataKey="booked" fill="#3157d5" name="จองแล้ว" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
