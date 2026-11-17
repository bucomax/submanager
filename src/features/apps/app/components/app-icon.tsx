"use client";

import { Blocks } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  iconUrl: string | null | undefined;
  accentColor: string | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  /** Texto alternativo; omitir quando o nome do app já aparece ao lado (decorativo). */
  alt?: string;
  className?: string;
};

const SIZE_MAP = {
  xs: { container: "size-6 rounded-md", icon: "size-3", img: "size-6 rounded-md" },
  sm: { container: "size-8 rounded-lg", icon: "size-4", img: "size-8 rounded-lg" },
  md: { container: "size-10 rounded-xl", icon: "size-5", img: "size-10 rounded-xl" },
  lg: { container: "size-16 rounded-2xl", icon: "size-8", img: "size-16 rounded-2xl" },
} as const;

export function AppIcon({ iconUrl, accentColor, size = "md", alt = "", className }: Props) {
  const s = SIZE_MAP[size];

  if (iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt={alt}
        loading="lazy"
        className={cn(s.img, "shrink-0 object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        s.container,
        "flex shrink-0 items-center justify-center bg-muted",
        className,
      )}
      style={accentColor ? { backgroundColor: `${accentColor}15` } : undefined}
    >
      <Blocks
        className={s.icon}
        style={accentColor ? { color: accentColor } : undefined}
      />
    </div>
  );
}
