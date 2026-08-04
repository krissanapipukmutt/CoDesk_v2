import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { apiFetch, toQuery } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import type { Department, PageResult, Profile, Role } from "../types";

interface Draft {
  employeeCode: string;
  fullName: string;
  email: string;
  temporaryPassword: string;
  departmentId: string;
  roleId: string;
  isActive: boolean;
}
const blank: Draft = {
  employeeCode: "",
  fullName: "",
  email: "",
  temporaryPassword: "",
  departmentId: "",
  roleId: "",
  isActive: true,
};
export function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(blank);
  const client = useQueryClient();
  const users = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () =>
      apiFetch<PageResult<Profile>>(
        "/api/admin/users" +
          toQuery({ search, pageSize: 100, includeInactive: true }),
      ),
  });
  const departments = useQuery({
    queryKey: ["departments-options"],
    queryFn: () =>
      apiFetch<PageResult<Department>>(
        "/api/departments" + toQuery({ pageSize: 100 }),
      ),
  });
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiFetch<Role[]>("/api/admin/users/roles"),
  });
  const save = useMutation({
    mutationFn: () =>
      apiFetch<Profile>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(draft),
      }),
    onSuccess: async () => {
      setOpen(false);
      setDraft(blank);
      await client.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
  const begin = () => {
    setDraft({
      ...blank,
      departmentId: departments.data?.items[0]?.departmentId ?? "",
      roleId: roles.data?.[0]?.roleId ?? "",
    });
    setOpen(true);
  };
  return (
    <>
      <PageHeader
        title="ผู้ใช้และสิทธิ์"
        description="สร้างบัญชีผ่าน Backend และ Supabase Admin API เท่านั้น คีย์ Service Role ไม่ถูกส่งไปเบราว์เซอร์"
        action={
          <Button onClick={begin}>
            <Plus size={17} />
            สร้างผู้ใช้
          </Button>
        }
      />
      <Card>
        <div className="mb-4 relative max-w-md">
          <Search className="absolute left-3 top-3 text-[#98a2b3]" size={17} />
          <input
            aria-label="ค้นหาผู้ใช้"
            className="field-input pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="รหัส ชื่อ หรืออีเมล"
          />
        </div>
        {users.isLoading ? (
          <LoadingState />
        ) : users.isError ? (
          <ErrorState message={users.error.message} />
        ) : !users.data?.items.length ? (
          <EmptyState />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อ</th>
                  <th>อีเมล</th>
                  <th>ฝ่าย</th>
                  <th>บทบาท</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {users.data!.items.map((profile) => (
                  <tr key={profile.profileId}>
                    <td className="font-semibold">{profile.employeeCode}</td>
                    <td>{profile.fullName}</td>
                    <td>{profile.email}</td>
                    <td>{profile.departmentCode}</td>
                    <td>{profile.roleName}</td>
                    <td>
                      <span
                        className={`status-pill ${profile.isActive ? "status-active" : "status-inactive"}`}
                      >
                        {profile.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="สร้างบัญชีผู้ใช้"
        description="ระบบจะสร้าง Auth user และ Profile ด้วย UUID เดียวกัน"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              disabled={
                save.isPending ||
                !draft.employeeCode ||
                !draft.fullName ||
                !draft.email ||
                draft.temporaryPassword.length < 8 ||
                !draft.departmentId ||
                !draft.roleId
              }
              onClick={() => save.mutate()}
            >
              สร้างผู้ใช้
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="field-label">รหัสพนักงาน</span>
              <input
                className="field-input"
                value={draft.employeeCode}
                onChange={(event) =>
                  setDraft({ ...draft, employeeCode: event.target.value })
                }
              />
            </label>
            <label>
              <span className="field-label">ชื่อ-นามสกุล</span>
              <input
                className="field-input"
                value={draft.fullName}
                onChange={(event) =>
                  setDraft({ ...draft, fullName: event.target.value })
                }
              />
            </label>
          </div>
          <label>
            <span className="field-label">อีเมล</span>
            <input
              type="email"
              className="field-input"
              value={draft.email}
              onChange={(event) =>
                setDraft({ ...draft, email: event.target.value })
              }
            />
          </label>
          <label>
            <span className="field-label">
              รหัสผ่านชั่วคราว (อย่างน้อย 8 ตัวอักษร)
            </span>
            <input
              type="password"
              className="field-input"
              value={draft.temporaryPassword}
              onChange={(event) =>
                setDraft({ ...draft, temporaryPassword: event.target.value })
              }
            />
          </label>
          <label>
            <span className="field-label">ฝ่ายงาน</span>
            <select
              className="field-input"
              value={draft.departmentId}
              onChange={(event) =>
                setDraft({ ...draft, departmentId: event.target.value })
              }
            >
              {departments.data?.items
                .filter((item) => item.isActive)
                .map((item) => (
                  <option key={item.departmentId} value={item.departmentId}>
                    {item.departmentCode} · {item.departmentName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span className="field-label">บทบาท</span>
            <select
              className="field-input"
              value={draft.roleId}
              onChange={(event) =>
                setDraft({ ...draft, roleId: event.target.value })
              }
            >
              {roles.data?.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.roleName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) =>
                setDraft({ ...draft, isActive: event.target.checked })
              }
            />
            เปิดใช้งานทันที
          </label>
          {save.isError && (
            <div
              role="alert"
              className="rounded-lg bg-[#fef3f2] p-3 text-sm text-[#b42318]"
            >
              {save.error.message}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
