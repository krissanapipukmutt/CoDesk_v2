import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "./ui/Button";
export function LoadingState() {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-[#667085]">
      <LoaderCircle className="animate-spin" size={20} />
      กำลังโหลดข้อมูล…
    </div>
  );
}
export function EmptyState({ message = "ไม่พบข้อมูล" }: { message?: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-[#667085]">
      <Inbox size={30} />
      <span>{message}</span>
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
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center text-[#b42318]">
      <AlertTriangle size={30} />
      <span>{message}</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          ลองใหม่
        </Button>
      )}
    </div>
  );
}
