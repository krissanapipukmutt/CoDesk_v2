import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { apiFetch, toQuery } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import type { Holiday, PageResult } from "../types";

interface Draft {
  holidayDate: string;
  holidayName: string;
  holidayDescription: string;
  isActive: boolean;
}
const blank: Draft = {
  holidayDate: "",
  holidayName: "",
  holidayDescription: "",
  isActive: true,
};
export function HolidaysPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("holidayDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<Holiday | null | undefined>(undefined);
  const [draft, setDraft] = useState(blank);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["holidays", search, sortBy, sortDirection],
    queryFn: () =>
      apiFetch<PageResult<Holiday>>(
        "/api/holidays" +
          toQuery({
            search,
            pageSize: 100,
            includeInactive: true,
            sortBy,
            sortDirection,
          }),
      ),
  });
  const save = useMutation({
    mutationFn: () =>
      apiFetch<Holiday>(
        editing ? `/api/holidays/${editing.holidayId}` : "/api/holidays",
        { method: editing ? "PUT" : "POST", body: JSON.stringify(draft) },
      ),
    onSuccess: async () => {
      setSuccess(editing ? "แก้ไขวันหยุดสำเร็จ" : "เพิ่มวันหยุดสำเร็จ");
      setEditing(undefined);
      await client.invalidateQueries({ queryKey: ["holidays"] });
    },
  });
  const open = (holiday?: Holiday) => {
    setEditing(holiday ?? null);
    setDraft(
      holiday
        ? {
            holidayDate: holiday.holidayDate,
            holidayName: holiday.holidayName,
            holidayDescription: holiday.holidayDescription ?? "",
            isActive: holiday.isActive,
          }
        : blank,
    );
  };
  return (
    <>
      <PageHeader
        title="จัดการวันหยุด"
        description="รายการจองในวันหยุดยังทำได้หลังผู้ใช้ยืนยันคำเตือน"
        action={
          <Button onClick={() => open()}>
            <Plus size={17} />
            เพิ่มวันหยุด
          </Button>
        }
      />
      <Card>
        {success && (
          <div className="mb-4 rounded-xl bg-[#ecfdf3] p-3 text-sm text-[#067647]">{success}</div>
        )}
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-3 text-[#98a2b3]" size={17} />
            <input
              aria-label="ค้นหาวันหยุด"
              className="field-input pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ชื่อหรือรายละเอียด"
            />
          </div>
          <select
            aria-label="เรียงวันหยุดตาม"
            className="field-input w-auto"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="holidayDate">วันที่</option>
            <option value="holidayName">ชื่อวันหยุด</option>
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
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ชื่อวันหยุด</th>
                  <th>รายละเอียด</th>
                  <th>สถานะ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.data!.items.map((holiday) => (
                  <tr key={holiday.holidayId}>
                    <td className="font-semibold">{holiday.holidayDate}</td>
                    <td>{holiday.holidayName}</td>
                    <td>{holiday.holidayDescription || "—"}</td>
                    <td>
                      <span
                        className={`status-pill ${holiday.isActive ? "status-active" : "status-inactive"}`}
                      >
                        {holiday.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => open(holiday)}
                      >
                        แก้ไข
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Dialog
        open={editing !== undefined}
        onOpenChange={(value) => {
          if (!value) setEditing(undefined);
        }}
        title={editing ? "แก้ไขวันหยุด" : "เพิ่มวันหยุด"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(undefined)}>
              ยกเลิก
            </Button>
            <Button
              disabled={
                save.isPending || !draft.holidayDate || !draft.holidayName
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
            <span className="field-label">วันที่</span>
            <input
              type="date"
              className="field-input"
              value={draft.holidayDate}
              onChange={(event) =>
                setDraft({ ...draft, holidayDate: event.target.value })
              }
            />
          </label>
          <label>
            <span className="field-label">ชื่อวันหยุด</span>
            <input
              className="field-input"
              value={draft.holidayName}
              onChange={(event) =>
                setDraft({ ...draft, holidayName: event.target.value })
              }
            />
          </label>
          <label>
            <span className="field-label">รายละเอียด</span>
            <textarea
              className="field-input"
              value={draft.holidayDescription}
              onChange={(event) =>
                setDraft({ ...draft, holidayDescription: event.target.value })
              }
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
            เปิดใช้งาน
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
