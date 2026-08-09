import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/Button";
export function LoadingState() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-[#667085]">
      <LoaderCircle className="animate-spin" size={20} />
      {t("common.loading")}
    </div>
  );
}
export function EmptyState({ message }: { message?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-[#667085]">
      <Inbox size={30} />
      <span>{message ?? t("common.noData")}</span>
    </div>
  );
}
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center text-[#b42318]">
      <AlertTriangle size={30} />
      <span>{message}</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
