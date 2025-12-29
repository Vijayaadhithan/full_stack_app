import React from "react";
import doorstepLogo from "@/assets/doorstep-ds-logo.png";
import { cn } from "@/lib/utils";

type LogoMarkProps = {
  size?: number;
  className?: string;
  variant?: "icon" | "ds";
};

export default function LogoMark({ size = 56, className }: LogoMarkProps) {

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-[18px] bg-white/90 shadow-sm",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="DoorStep logo"
    >
      <img
        src={doorstepLogo}
        alt="DoorStep"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
