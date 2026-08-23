import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch, toQuery } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import { useAuth } from "../auth/useAuth";
import { localizedError } from "../i18n/format";
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManageHolidays = user?.roleCode === "hr" || user?.roleCode === "admin";
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("holidayDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<Holiday | null | undefined>(undefined);
  const [draft, setDraft] = useState(blank);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["holidays", search, sortBy, sortDirection, canManageHolidays],
    queryFn: () =>
      apiFetch<PageResult<Holiday>>(
        "/api/holidays" +
          toQuery({
            search,
            pageSize: 100,
            includeInactive: canManageHolidays,
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
      setSuccess(editing ? "holidays.updated" : "holidays.added");
      setEditing(undefined);
      await client.invalidateQueries({ queryKey: ["holidays"] });
    },
  });
  const open = (holiday?: Holiday) => {
    if (!canManageHolidays) return;
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
        title={t("holidays.title")}
        description={t("holidays.description")}
        action={
          canManageHolidays ? (
            <Button onClick={() => open()}>
              <Plus size={17} />
              {t("holidays.add")}
            </Button>
          ) : undefined
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
              aria-label={t("holidays.searchLabel")}
              className="field-input !pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("holidays.searchPlaceholder")}
            />
          </div>
          <select
            aria-label={t("holidays.sortLabel")}
            className="field-input w-auto"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="holidayDate">{t("holidays.date")}</option>
            <option value="holidayName">{t("holidays.name")}</option>
            <option value="isActive">{t("holidays.status")}</option>
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
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("holidays.date")}</th>
                  <th>{t("holidays.name")}</th>
                  <th>{t("holidays.descriptionField")}</th>
                  <th>{t("holidays.status")}</th>
                  {canManageHolidays && <th />}
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
                        {holiday.isActive ? t("common.active") : t("common.inactive")}
                      </span>
                    </td>
                    {canManageHolidays && (
                      <td>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => open(holiday)}
                        >
                          {t("common.edit")}
                        </Button>
                      </td>
                    )}
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
        title={editing ? t("holidays.edit") : t("holidays.add")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(undefined)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={
                save.isPending || !draft.holidayDate || !draft.holidayName
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
            <span className="field-label">{t("holidays.date")}</span>
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
            <span className="field-label">{t("holidays.name")}</span>
            <input
              className="field-input"
              value={draft.holidayName}
              onChange={(event) =>
                setDraft({ ...draft, holidayName: event.target.value })
              }
            />
          </label>
          <label>
            <span className="field-label">{t("holidays.descriptionField")}</span>
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
            {t("holidays.enable")}
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
