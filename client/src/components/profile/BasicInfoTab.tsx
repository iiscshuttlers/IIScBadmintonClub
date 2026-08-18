import React from "react";
import { UserCircle, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { PREDEFINED_DEPARTMENTS } from "@/data/departments";

interface BasicInfoTabProps {
  avatarUrl: string;
  setAvatarUrl: (val: string) => void;
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fullName: string;
  setFullName: (val: string) => void;
  nickname: string;
  setNickname: (val: string) => void;
  iiscEmail: string;
  setIiscEmail: (val: string) => void;
  contactNumber: string;
  setContactNumber: (val: string) => void;
  gender: string;
  setGender: (val: string) => void;
  joinedYear: string;
  setJoinedYear: (val: string) => void;
  department: string;
  setDepartment: (val: string) => void;
  customDepartment: string;
  setCustomDepartment: (val: string) => void;
  isGuest: boolean;
}

export function BasicInfoTab({
  avatarUrl,
  setAvatarUrl,
  handleAvatarUpload,
  fullName,
  setFullName,
  nickname,
  setNickname,
  iiscEmail,
  setIiscEmail,
  contactNumber,
  setContactNumber,
  gender,
  setGender,
  joinedYear,
  setJoinedYear,
  department,
  setDepartment,
  customDepartment,
  setCustomDepartment,
  isGuest,
}: BasicInfoTabProps) {
  return (
    <motion.div
      key="basic"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Avatar Upload / URL picker */}
      <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-primary" />
          Profile Picture (Avatar)
        </h3>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <label className="relative w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-700 cursor-pointer group shadow-sm hover:shadow-md transition-shadow">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar Preview"
                className="w-full h-full object-cover transition-opacity group-hover:opacity-50"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground dark:text-muted-foreground text-3xl font-bold uppercase transition-opacity group-hover:opacity-50">
                {fullName ? fullName.charAt(0) : "U"}
              </div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 text-foreground">
              <Upload className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold">Upload</span>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </label>

          <div className="flex-1 w-full space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Direct Image Link
              </label>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. https://images.unsplash.com/... or your custom avatar URL"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-muted-foreground">
              <span>or</span>
              <label className="flex items-center gap-1 cursor-pointer font-bold text-primary hover:text-primary dark:text-primary">
                <Upload className="w-3.5 h-3.5" />
                Upload Image File
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-2">
            Full Name *
          </label>
          <input
            required
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
            placeholder="e.g. Tanu Singh"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-2">
            Nickname / Alias
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
            placeholder="e.g. Tanya"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-2">
            IISc Email *
          </label>
          <input
            required
            type="email"
            value={iiscEmail}
            onChange={(e) => setIiscEmail(e.target.value)}
            pattern="^[a-zA-Z0-9._%+\-]+@(alum\.)?iisc\.ac\.in$"
            title="Email must end with @iisc.ac.in or @alum.iisc.ac.in"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
            placeholder="e.g. tanu@iisc.ac.in"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-2">
            Contact Number *
          </label>
          <input
            required
            type="tel"
            pattern="[0-9]{10}"
            title="Please enter exactly 10 digits"
            value={contactNumber}
            onChange={(e) =>
              setContactNumber(
                e.target.value.replace(/\D/g, "").slice(0, 10),
              )
            }
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
            placeholder="e.g. 9876543210"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-2">
            Gender * <span className="text-xs font-normal text-muted-foreground ml-1">(Hidden from profile, used only for match logic)</span>
          </label>
          <select
            required
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
          >
            <option value="" disabled>Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-2">
            Joined Year (Class of) *
          </label>
          <input
            required
            type="number"
            min="1900"
            max={new Date().getFullYear() + 5}
            value={joinedYear}
            onChange={(e) => setJoinedYear(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
            placeholder="e.g. 2023"
          />
        </div>
      </div>

      {!isGuest && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-2">
              Department *
            </label>
            <select
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
            >
              <option value="" disabled>
                Select your department
              </option>
              {PREDEFINED_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
              <option value="Other">Other (Please specify)</option>
            </select>
          </div>

          {department === "Other" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="pt-2"
            >
              <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-2">
                Specify Department *
              </label>
              <input
                required
                type="text"
                value={customDepartment}
                onChange={(e) => setCustomDepartment(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                placeholder="e.g. Center for Nano Science"
              />
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
