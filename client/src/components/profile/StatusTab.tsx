import React from "react";
import { ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

interface StatusTabProps {
  isGuest: boolean;
  setIsGuest: (val: boolean) => void;
  isRetired: boolean;
  setIsRetired: (val: boolean) => void;
  department: string;
  setDepartment: (val: string) => void;
}

export function StatusTab({
  isGuest,
  setIsGuest,
  isRetired,
  setIsRetired,
  department,
  setDepartment,
}: StatusTabProps) {
  return (
    <motion.div
      key="status"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold text-soft">
          Account Status & Visibility
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl border border-border-strong">
          <input
            type="checkbox"
            id="isGuest"
            checked={isGuest}
            onChange={(e) => {
              setIsGuest(e.target.checked);
              if (e.target.checked) {
                setDepartment("Guest");
              } else if (department === "Guest") {
                setDepartment("");
              }
            }}
            className="w-5 h-5 rounded border-border-strong text-primary focus:ring-primary bg-card"
          />
          <label htmlFor="isGuest" className="text-sm font-semibold text-soft cursor-pointer">
            I am a Guest / Project Assistant / Intern
            <p className="text-xs text-muted-foreground font-normal mt-0.5">Select this if you are not an active IISc degree student.</p>
          </label>
        </div>

        <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl border border-danger/30">
          <input
            type="checkbox"
            id="isRetired"
            checked={isRetired}
            onChange={(e) => setIsRetired(e.target.checked)}
            className="w-5 h-5 rounded border-danger text-danger focus:ring-danger bg-card"
          />
          <label htmlFor="isRetired" className="text-sm font-semibold text-danger cursor-pointer">
            Mark Profile as Retired
            <p className="text-xs text-danger font-normal mt-0.5">Retired players are hidden from rankings and cannot be challenged.</p>
          </label>
        </div>
      </div>
    </motion.div>
  );
}
