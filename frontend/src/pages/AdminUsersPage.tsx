import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch, toQuery } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import type { Department, PageResult, Profile, Role } from "../types";
import { localizedError, roleLabel } from "../i18n/format";

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
  const { t } = useTranslation();
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
        title={t("users.title")}
        description={t("users.description")}
        action={
          <Button onClick={begin}>
            <Plus size={17} />
            {t("users.create")}
          </Button>
        }
      />
      <Card>
        <div className="mb-4 relative max-w-md">
          <Search className="absolute left-3 top-3 text-[#98a2b3]" size={17} />
          <input
            aria-label={t("users.searchLabel")}
            className="field-input pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("users.searchPlaceholder")}
          />
        </div>
        {users.isLoading ? (
          <LoadingState />
        ) : users.isError ? (
          <ErrorState message={localizedError(t, users.error)} />
        ) : !users.data?.items.length ? (
          <EmptyState />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("users.code")}</th>
                  <th>{t("users.name")}</th>
                  <th>{t("users.email")}</th>
                  <th>{t("users.department")}</th>
                  <th>{t("users.profileTimezone")}</th>
                  <th>{t("users.role")}</th>
                  <th>{t("users.status")}</th>
                </tr>
              </thead>
              <tbody>
                {users.data!.items.map((profile) => (
                  <tr key={profile.profileId}>
                    <td className="font-semibold">{profile.employeeCode}</td>
                    <td>{profile.fullName}</td>
                    <td>{profile.email}</td>
                    <td>{profile.departmentCode}</td>
                    <td>{profile.timezoneName}</td>
                    <td>{roleLabel(t, profile.roleCode)}</td>
                    <td>
                      <span
                        className={`status-pill ${profile.isActive ? "status-active" : "status-inactive"}`}
                      >
                        {profile.isActive ? t("common.active") : t("common.inactive")}
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
        title={t("users.dialogTitle")}
        description={t("users.dialogDescription")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("common.cancel")}
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
              {t("users.create")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="field-label">{t("users.employeeCode")}</span>
              <input
                className="field-input"
                value={draft.employeeCode}
                onChange={(event) =>
                  setDraft({ ...draft, employeeCode: event.target.value })
                }
              />
            </label>
            <label>
              <span className="field-label">{t("users.fullName")}</span>
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
            <span className="field-label">{t("users.email")}</span>
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
              {t("users.temporaryPassword")}
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
            <span className="field-label">{t("users.departmentField")}</span>
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
            <p className="mt-1 text-xs text-[#667085]">
              {t("users.timezoneHint", { timezone: departments.data?.items.find(
                (department) => department.departmentId === draft.departmentId,
              )?.effectiveTimezone ?? t("common.noValue") })}
            </p>
          </label>
          <label>
            <span className="field-label">{t("users.role")}</span>
            <select
              className="field-input"
              value={draft.roleId}
              onChange={(event) =>
                setDraft({ ...draft, roleId: event.target.value })
              }
            >
              {roles.data?.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {roleLabel(t, role.roleCode)}
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
            {t("users.enableNow")}
          </label>
          {save.isError && (
            <div
              role="alert"
              className="rounded-lg bg-[#fef3f2] p-3 text-sm text-[#b42318]"
            >
              {localizedError(t, save.error)}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
