import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  description?: string;
  message?: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  confirmColor?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<(value: boolean) => void>();

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    if (resolver) resolver(true);
  };

  const handleCancel = () => {
    setOpen(false);
    if (resolver) resolver(false);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <ConfirmDialog
          open={open}
          title={options.title}
          description={options.description || options.message || ""}
          confirmLabel={options.confirmLabel || options.confirmText || "Confirm"}
          cancelLabel={options.cancelLabel || "Cancel"}
          confirmVariant={options.confirmVariant || (options.confirmColor?.includes("red") ? "danger" : "primary")}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used within ConfirmProvider");
  return context;
}
