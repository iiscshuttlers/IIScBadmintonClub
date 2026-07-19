import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 1).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const sizes = {
  xs: "w-7 h-7 text-xs",
  sm: "w-9 h-9 text-sm",
  md: "w-11 h-11 text-base",
  lg: "w-14 h-14 text-lg",
  xl: "w-20 h-20 text-2xl",
};

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const initials = getInitials(name);
  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden flex items-center justify-center flex-shrink-0",
        "bg-gradient-to-br from-primary to-primary font-bold text-primary-foreground ring-1 ring-primary/30 dark:ring-primary",
        sizes[size],
        className
      )}
    >
      {src ? (
        <img src={src} alt={name ?? "avatar"} className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
