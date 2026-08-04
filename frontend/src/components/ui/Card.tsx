import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#e4e8f0] bg-white p-5 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-[#172033]">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-[#667085]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
