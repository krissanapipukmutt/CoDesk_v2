import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { apiFetch, toQuery } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Pagination } from "../components/Pagination";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import type { Department, PageResult } from "../types";

interface DepartmentDraft {
  departmentCode: string;
  departmentName: string;
  capacityMode: "limited" | "unlimited";
  defaultCapacityPerDay: string;
  isActive: boolean;
  effectiveTimezone: string;
}
const blank: DepartmentDraft = {
  departmentCode: "",
  departmentName: "",
  capacityMode: "limited",
  defaultCapacityPerDay: "1",
  isActive: true,
  effectiveTimezone: "Asia/Bangkok",
};

export function DepartmentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("departmentName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<Department | null | undefined>(
    undefined,
  );
  const [draft, setDraft] = useState(blank);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["departments", search, page, sortBy, sortDirection],
    queryFn: () =>
      apiFetch<PageResult<Department>>(
        "/api/departments" +
          toQuery({
            search,
            page,
            pageSize: 10,
            includeInactive: true,
            sortBy,
            sortDirection,
          }),
      ),
  });
  const save = useMutation({
    mutationFn: () =>
      apiFetch<Department>(
        editing
          ? `/api/departments/${editing.departmentId}`
          : "/api/departments",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({
            ...draft,
            defaultCapacityPerDay:
              draft.capacityMode === "limited"
                ? Number(draft.defaultCapacityPerDay)
                : null,
          }),
        },
      ),
    onSuccess: async () => {
      setSuccess(editing ? "แก้ไขฝ่ายงานสำเร็จ" : "เพิ่มฝ่ายงานสำเร็จ");
      setEditing(undefined);
      await client.invalidateQueries({ queryKey: ["departments"] });
    },
  });
  const open = (department?: Department) => {
    setEditing(department ?? null);
    setDraft(
      department
        ? {
            departmentCode: department.departmentCode,
            departmentName: department.departmentName,
            capacityMode: department.capacityMode,
            defaultCapacityPerDay: String(
              department.defaultCapacityPerDay ?? "",
            ),
            isActive: department.isActive,
            effectiveTimezone: department.effectiveTimezone,
          }
        : blank,
    );
  };
  return (
    <>
      <PageHeader
        title="จัดการฝ่ายงาน"
        description="กำหนดความจุรายวันหรือเลือกไม่จำกัด โดยใช้การปิดใช้งานแบบ Soft Delete"
        action={
          <Button onClick={() => open()}>
            <Plus size={17} />
            เพิ่มฝ่ายงาน
          </Button>
        }
      />
      <Card>
        {success && (
          <div className="mb-4 rounded-xl bg-[#ecfdf3] p-3 text-sm text-[#067647]">{success}</div>
        )}
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative max-w-md flex-1">
            <Search
              className="absolute left-3 top-3 text-[#98a2b3]"
              size={17}
            />
            <input
              aria-label="ค้นหาฝ่ายงาน"
              className="field-input pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="รหัสหรือชื่อฝ่าย"
            />
          </div>
          <select
            aria-label="เรียงฝ่ายงานตาม"
            className="field-input w-auto"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value);
              setPage(1);
            }}
          >
            <option value="departmentName">ชื่อฝ่าย</option>
            <option value="capacityMode">รูปแบบความจุ</option>
            <option value="isActive">สถานะ</option>
          </select>
          <Button
            variant="secondary"
            onClick={() => setSortDirection((value) => (value === "asc" ? "desc" : "asc"))}
          >
            {sortDirection === "asc" ? "น้อย → มาก" : "มาก → น้อย"}
          </Button>
        </div>
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState message={query.error.message} />
        ) : !query.data?.items.length ? (
          <EmptyState />
        ) : (
          <>
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>รหัส</th>
                    <th>ชื่อฝ่าย</th>
                    <th>รูปแบบความจุ</th>
                    <th>ความจุ/วัน</th>
                    <th>เขตเวลา</th>
                    <th>สถานะ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {query.data!.items.map((department) => (
                    <tr key={department.departmentId}>
                      <td className="font-semibold">
                        {department.departmentCode}
                      </td>
                      <td>{department.departmentName}</td>
                      <td>
                        {department.capacityMode === "limited"
                          ? "จำกัด"
                          : "ไม่จำกัด"}
                      </td>
                      <td>{department.defaultCapacityPerDay ?? "—"}</td>
                      <td>{department.effectiveTimezone}</td>
                      <td>
                        <span
                          className={`status-pill ${department.isActive ? "status-active" : "status-inactive"}`}
                        >
                          {department.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                        </span>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => open(department)}
                        >
                          แก้ไข
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={10}
              total={query.data!.total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
      <Dialog
        open={editing !== undefined}
        onOpenChange={(value) => {
          if (!value) setEditing(undefined);
        }}
        title={editing ? "แก้ไขฝ่ายงาน" : "เพิ่มฝ่ายงาน"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(undefined)}>
              ยกเลิก
            </Button>
            <Button
              disabled={
                save.isPending ||
                !draft.departmentCode ||
                !draft.departmentName ||
                (draft.capacityMode === "limited" &&
                  Number(draft.defaultCapacityPerDay) <= 0)
              }
              onClick={() => save.mutate()}
            >
              บันทึก
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label>
            <span className="field-label">รหัสฝ่าย</span>
            <input
              className="field-input"
              value={draft.departmentCode}
              onChange={(event) =>
                setDraft({ ...draft, departmentCode: event.target.value })
              }
            />
          </label>
          <label>
            <span className="field-label">ชื่อฝ่าย</span>
            <input
              className="field-input"
              value={draft.departmentName}
              onChange={(event) =>
                setDraft({ ...draft, departmentName: event.target.value })
              }
            />
          </label>
          <label>
            <span className="field-label">รูปแบบความจุ</span>
            <select
              className="field-input"
              value={draft.capacityMode}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  capacityMode: event.target
                    .value as DepartmentDraft["capacityMode"],
                  defaultCapacityPerDay:
                    event.target.value === "unlimited" ? "" : "1",
                })
              }
            >
              <option value="limited">จำกัด</option>
              <option value="unlimited">ไม่จำกัด</option>
            </select>
          </label>
          {draft.capacityMode === "limited" && (
            <label>
              <span className="field-label">จำนวนสูงสุดต่อวัน</span>
              <input
                className="field-input"
                type="number"
                min="1"
                value={draft.defaultCapacityPerDay}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    defaultCapacityPerDay: event.target.value,
                  })
                }
              />
            </label>
          )}
          <label>
            <span className="field-label">เขตเวลา</span>
            <input
              className="field-input"
              value={draft.effectiveTimezone}
              readOnly
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) =>
                setDraft({ ...draft, isActive: event.target.checked })
              }
            />
            เปิดใช้งานฝ่าย
          </label>
          {save.isError && (
            <p role="alert" className="text-sm text-[#b42318]">
              {save.error.message}
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
