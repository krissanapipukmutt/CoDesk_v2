import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch, toQuery } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Pagination } from "../components/Pagination";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import type { Department, PageResult } from "../types";
import { capacityModeLabel, localizedError } from "../i18n/format";
import { DEFAULT_TIMEZONE } from "../utils/date";

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
  effectiveTimezone: DEFAULT_TIMEZONE,
};

export function DepartmentsPage() {
  const { t } = useTranslation();
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
  const timezones = useQuery({
    queryKey: ["supported-timezones"],
    queryFn: () => apiFetch<string[]>("/api/departments/timezones"),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const timezoneIsValid =
    timezones.data?.includes(draft.effectiveTimezone) ?? false;
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
      setSuccess(editing ? "departments.updated" : "departments.added");
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
        title={t("departments.title")}
        description={t("departments.description")}
        action={
          <Button onClick={() => open()}>
            <Plus size={17} />
            {t("departments.add")}
          </Button>
        }
      />
      <Card>
        {success && (
          <div className="mb-4 rounded-xl bg-[#ecfdf3] p-3 text-sm text-[#067647]">{t(success)}</div>
        )}
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative max-w-md flex-1">
            <Search
              className="absolute left-3 top-3 text-[#98a2b3]"
              size={17}
            />
            <input
              aria-label={t("departments.searchLabel")}
              className="field-input !pl-10"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t("departments.searchPlaceholder")}
            />
          </div>
          <select
            aria-label={t("departments.sortLabel")}
            className="field-input w-auto"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value);
              setPage(1);
            }}
          >
            <option value="departmentName">{t("departments.name")}</option>
            <option value="capacityMode">{t("departments.capacityMode")}</option>
            <option value="isActive">{t("departments.status")}</option>
          </select>
          <Button
            variant="secondary"
            onClick={() => setSortDirection((value) => (value === "asc" ? "desc" : "asc"))}
          >
            {sortDirection === "asc" ? t("common.ascending") : t("common.descending")}
          </Button>
        </div>
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState message={localizedError(t, query.error)} />
        ) : !query.data?.items.length ? (
          <EmptyState />
        ) : (
          <>
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("departments.code")}</th>
                    <th>{t("departments.name")}</th>
                    <th>{t("departments.capacityMode")}</th>
                    <th>{t("departments.capacityPerDay")}</th>
                    <th>{t("departments.timezone")}</th>
                    <th>{t("departments.status")}</th>
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
                        {capacityModeLabel(t, department.capacityMode)}
                      </td>
                      <td>{department.defaultCapacityPerDay ?? "—"}</td>
                      <td>{department.effectiveTimezone}</td>
                      <td>
                        <span
                          className={`status-pill ${department.isActive ? "status-active" : "status-inactive"}`}
                        >
                          {department.isActive ? t("common.active") : t("common.inactive")}
                        </span>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => open(department)}
                        >
                          {t("common.edit")}
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
        title={editing ? t("departments.edit") : t("departments.add")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(undefined)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={
                save.isPending ||
                !draft.departmentCode ||
                !draft.departmentName ||
                !timezoneIsValid ||
                (draft.capacityMode === "limited" &&
                  Number(draft.defaultCapacityPerDay) <= 0)
              }
              onClick={() => save.mutate()}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label>
            <span className="field-label">{t("departments.codeField")}</span>
            <input
              className="field-input"
              value={draft.departmentCode}
              onChange={(event) =>
                setDraft({ ...draft, departmentCode: event.target.value })
              }
            />
          </label>
          <label>
            <span className="field-label">{t("departments.name")}</span>
            <input
              className="field-input"
              value={draft.departmentName}
              onChange={(event) =>
                setDraft({ ...draft, departmentName: event.target.value })
              }
            />
          </label>
          <label>
            <span className="field-label">{t("departments.capacityMode")}</span>
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
              <option value="limited">{t("status.limited")}</option>
              <option value="unlimited">{t("status.unlimited")}</option>
            </select>
          </label>
          {draft.capacityMode === "limited" && (
            <label>
              <span className="field-label">{t("departments.maximumPerDay")}</span>
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
            <span className="field-label">{t("departments.timezone")}</span>
            <input
              aria-label={t("departments.timezone")}
              className="field-input"
              list="supported-timezones"
              autoComplete="off"
              value={draft.effectiveTimezone}
              onChange={(event) =>
                setDraft({ ...draft, effectiveTimezone: event.target.value })
              }
            />
            <datalist id="supported-timezones">
              {timezones.data?.map((timezoneName) => (
                <option key={timezoneName} value={timezoneName} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-[#667085]">
              {t("departments.timezoneHelp")}
            </p>
            {draft.effectiveTimezone && !timezoneIsValid && !timezones.isLoading && (
              <p className="field-error">{t("departments.timezoneInvalid")}</p>
            )}
            {timezones.isError && (
              <p className="field-error">{t("departments.timezoneLoadFailed")}</p>
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
            {t("departments.enable")}
          </label>
          {save.isError && (
            <p role="alert" className="text-sm text-[#b42318]">
              {localizedError(t, save.error)}
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
