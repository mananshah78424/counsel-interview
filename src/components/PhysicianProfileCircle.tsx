import { ComponentProps } from "react";
import { Icons } from "./icons";
import { cn } from "@/utils/cssUtils";

interface PhysicianProfileCircleProps extends ComponentProps<"div"> {}

export function PhysicianProfileCircle({
  className,
  ...props
}: PhysicianProfileCircleProps) {
  return (
    <div className={cn("w-6 rounded-xl flex-shrink-0", className)} {...props}>
      <Icons.threadIcon className={cn(`text-brand-teal`)} />
    </div>
  );
}
