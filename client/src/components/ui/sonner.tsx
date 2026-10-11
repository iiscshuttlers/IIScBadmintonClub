import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "bg-slate-900/95 border border-slate-700/80 text-foreground dark:text-foreground shadow-2xl backdrop-blur-md rounded-2xl p-4 font-sans max-w-sm sm:max-w-md mx-auto",
          title: "font-black text-sm text-white",
          description:
            "!text-slate-300 !opacity-100 font-medium text-xs mt-0.5",
          actionButton:
            "!bg-primary !text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl hover:!bg-primary/90 transition shadow-sm",
          cancelButton:
            "!bg-slate-800 !text-slate-300 font-bold text-xs px-3 py-1.5 rounded-xl hover:!bg-slate-700 transition",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          top: "max(env(safe-area-inset-top), 1rem)",
        } as React.CSSProperties
      }
      duration={3500}
      {...props}
    />
  );
};


export { Toaster };
