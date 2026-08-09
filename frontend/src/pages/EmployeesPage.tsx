import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch, toQuery } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Pagination } from "../components/Pagination";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import type {
  Department,
  DepartmentHistory,
  PageResult,
  Profile,
  Role,
} from "../types";
import { localizedError, roleLabel } from "../i18n/format";

interface Draft {
  employeeCode: string;
  fullName: string;
  email: string;
  departmentId: string;
  roleId: string;
  isActive: boolean;
}
export function EmployeesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("fullName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const profiles = useQuery({
    queryKey: ["profiles-manage", search, page, sortBy, sortDirection],
    queryFn: () =>
      apiFetch<PageResult<Profile>>(
        "/api/profiles" +
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
  const departments = useQuery({
    queryKey: ["departments-options"],
    queryFn: () =>
      apiFetch<PageResult<Department>>(
        "/api/departments" + toQuery({ pageSize: 100, includeInactive: true }),
      ),
  });
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiFetch<Role[]>("/api/admin/users/roles"),
    enabled: user?.roleCode === "admin",
  });
  const history = useQuery({
    queryKey: ["department-history", editing?.profileId],
    queryFn: () =>
      apiFetch<DepartmentHistory[]>(
        `/api/profiles/${editing?.profileId}/department-history`,
      ),
    enabled: Boolean(editing),
  });
  const save = useMutation({
    mutationFn: () =>
      apiFetch<Profile>(`/api/profiles/${editing?.profileId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...draft,
          roleId: user?.roleCode === "admin" ? draft?.roleId : null,
        }),
      }),
    onSuccess: async () => {
      const updatedProfileId = editing?.profileId;
      setSuccess("employees.updated");
      setEditing(null);
      setDraft(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["profiles-manage"] }),
        client.invalidateQueries({
          queryKey: ["department-history", updatedProfileId],
        }),
      ]);
    },
  });
  if (!user) return null;
  const open = (profile: Profile) => {
    setEditing(profile);
    setDraft({
      employeeCode: profile.employeeCode,
      fullName: profile.fullName,
      email: profile.email,
      departmentId: profile.departmentId,
      roleId: profile.roleId,
      isActive: profile.isActive,
    });
  };
  return (
    <>
      <PageHeader
        title={t("employees.title")}
        description={
          user.roleCode === "hr"
            ? t("employees.hrDescription")
            : t("employees.adminDescription")
        }
      />
      <Card>
        {success && (
          <div className="mb-4 rounded-xl bg-[#ecfdf3] p-3 text-sm text-[#067647]">{t(success)}</div>
        )}
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-3 text-[#98a2b3]" size={17} />
            <input
              aria-label={t("employees.searchLabel")}
              className="field-input pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t("employees.searchPlaceholder")}
            />
          </div>
          <select
            aria-label={t("employees.sortLabel")}
            className="field-input w-auto"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value);
              setPage(1);
            }}
          >
            <option value="fullName">{t("employees.name")}</option>
            <option value="email">{t("employees.email")}</option>
            <option value="departmentName">{t("employees.department")}</option>
            <option value="roleCode">{t("employees.role")}</option>
            <option value="isActive">{t("employees.status")}</option>
          </select>
          <Button
            variant="secondary"
            onClick={() => setSortDirection((value) => (value === "asc" ? "desc" : "asc"))}
          >
            {sortDirection === "asc" ? t("common.ascending") : t("common.descending")}
          </Button>
        </div>
        {profiles.isLoading ? (
          <LoadingState />
        ) : profiles.isError ? (
          <ErrorState message={localizedError(t, profiles.error)} />
        ) : !profiles.data?.items.length ? (
          <EmptyState />
        ) : (
          <>
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("employees.code")}</th>
                    <th>{t("employees.name")}</th>
                    <th>{t("employees.email")}</th>
                    <th>{t("employees.department")}</th>
                    <th>{t("employees.profileTimezone")}</th>
                    <th>{t("employees.role")}</th>
                    <th>{t("employees.status")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {profiles.data!.items.map((profile) => (
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
                      <td>
                        {(user.roleCode === "admin" ||
                          profile.roleCode === "employee") && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => open(profile)}
                          >
                            {t("common.edit")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={10}
              total={profiles.data!.total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
      <Dialog
        open={Boolean(editing && draft)}
        onOpenChange={(openValue) => {
          if (!openValue) {
            setEditing(null);
            setDraft(null);
          }
        }}
        title={t("employees.editTitle")}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setDraft(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              disabled={
                save.isPending ||
                !draft?.employeeCode ||
                !draft.fullName ||
                !draft.email
              }
              onClick={() => save.mutate()}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="field-label">{t("employees.employeeCode")}</span>
                <input
                  className="field-input"
                  value={draft.employeeCode}
                  onChange={(event) =>
                    setDraft({ ...draft, employeeCode: event.target.value })
                  }
                />
              </label>
              <label>
                <span className="field-label">{t("employees.fullName")}</span>
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
              <span className="field-label">{t("employees.email")}</span>
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
              <span className="field-label">{t("employees.departmentField")}</span>
              <select
                className="field-input"
                value={draft.departmentId}
                onChange={(event) =>
                  setDraft({ ...draft, departmentId: event.target.value })
                }
              >
                {departments.data?.items
                  .filter((department) => department.isActive || department.departmentId === editing?.departmentId)
                  .map((department) => (
                  <option
                    key={department.departmentId}
                    value={department.departmentId}
                    disabled={!department.isActive}
                  >
                    {department.departmentCode} · {department.departmentName}{department.isActive ? "" : ` ${t("employees.inactiveSuffix")}`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[#667085]">
                {t("employees.timezoneAfterSave", { timezone: departments.data?.items.find(
                  (department) => department.departmentId === draft.departmentId,
                )?.effectiveTimezone ?? t("common.noValue") })}
              </p>
            </label>
            <label>
              <span className="field-label">{t("employees.role")}</span>
              {user.roleCode === "admin" ? (
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
              ) : (
                <input
                  className="field-input bg-[#f8f9fc]"
                  value={editing ? roleLabel(t, editing.roleCode) : ""}
                  readOnly
                />
              )}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft({ ...draft, isActive: event.target.checked })
                }
              />
              {t("employees.enable")}
            </label>
            {save.isError && (
              <p role="alert" className="text-sm text-[#b42318]">
                {localizedError(t, save.error)}
              </p>
            )}
            <div className="border-t border-[#e4e8f0] pt-4">
              <h3 className="mb-2 font-semibold">{t("employees.history")}</h3>
              {history.isLoading ? (
                <p className="text-sm text-[#667085]">{t("common.loadingShort")}</p>
              ) : (
                <div className="space-y-2">
                  {history.data?.map((item) => (
                    <div
                      key={item.historyId}
                      className="rounded-lg bg-[#f8f9fc] p-3 text-sm"
                    >
                      <strong>
                        {item.departmentCode} · {item.departmentName}
                      </strong>
                      <div className="text-[#667085]">
                        {t("employees.historyLine", {
                          start: item.assignedStartDate,
                          end: item.assignedEndDate ?? t("common.current"),
                          name: item.assignedByName,
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
