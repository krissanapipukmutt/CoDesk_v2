import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
  {
    variants: {
      variant: {
        primary: "bg-[#3157d5] text-white hover:bg-[#233f9d]",
        secondary:
          "border border-[#d0d5dd] bg-white text-[#344054] hover:bg-[#f8f9fc]",
        danger: "bg-[#d92d20] text-white hover:bg-[#b42318]",
        ghost: "text-[#475467] hover:bg-[#eef2ff]",
      },
      size: { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;
export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
