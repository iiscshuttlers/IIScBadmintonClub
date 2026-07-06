import { useState, useRef } from "react";
import { Upload, Loader2, User, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export interface ConvenerData {
  convener: {
    name: string;
    description: string;
    imageUrl: string;
  };
  coConvener: {
    name: string;
    description: string;
    imageUrl: string;
  };
}

export const DEFAULT_CONVENER_DATA: ConvenerData = {
  convener: {
    name: "Raja Janmejay",
    description: "Leading the club with vision and passion for the sport",
    imageUrl: "",
  },
  coConvener: {
    name: "Aneesh Varla",
    description: "Helping members connect, compete, and grow through badminton",
    imageUrl: "",
  },
};

const inputCls =
  "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition";
const labelCls =
  "block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5";

function ImageUploadField({
  label,
  currentUrl,
  onUrlChange,
}: {
  label: string;
  currentUrl: string;
  onUrlChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      toast.error("Cloudinary is not configured. Check VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.");
      return;
    }

    setUploading(true);
    try {
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", "conveners");

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formData }
      );
      const json = await res.json();

      if (!res.ok || !json.secure_url) {
        throw new Error(json.error?.message || "Upload failed");
      }

      onUrlChange(json.secure_url);
      toast.success(`${label} photo uploaded!`);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = preview || currentUrl;

  return (
    <div className="space-y-3">
      <p className={labelCls}>{label} Photo</p>

      {/* Preview */}
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
          {displayUrl ? (
            <img src={displayUrl} alt={label} className="w-full h-full object-cover" />
          ) : (
            <User className="w-8 h-8 text-muted-foreground" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-sm font-bold transition disabled:opacity-50 w-full justify-center"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Upload className="w-4 h-4 shrink-0" />
            )}
            {uploading ? "Uploading..." : "Upload Photo"}
          </button>

          {currentUrl && (
            <button
              type="button"
              onClick={() => { onUrlChange(""); setPreview(null); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold transition"
            >
              <X className="w-3 h-3" /> Remove
            </button>
          )}
        </div>
      </div>

      {/* URL input as alternative */}
      <div>
        <label className={labelCls}>Or paste image URL</label>
        <input
          className={inputCls}
          type="url"
          placeholder="https://..."
          value={currentUrl}
          onChange={(e) => onUrlChange(e.target.value)}
        />
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function PersonCard({
  title,
  data,
  onChange,
}: {
  title: string;
  data: ConvenerData["convener"];
  onChange: (d: ConvenerData["convener"]) => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
      <h3 className="text-base font-black text-foreground dark:text-foreground flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary inline-block" />
        {title}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Name</label>
          <input
            className={inputCls}
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder="Full name"
          />
        </div>
        <div>
          <label className={labelCls}>Tagline / Description</label>
          <input
            className={inputCls}
            value={data.description}
            onChange={(e) => onChange({ ...data, description: e.target.value })}
            placeholder="Short tagline"
          />
        </div>
      </div>

      <ImageUploadField
        label={title}
        currentUrl={data.imageUrl}
        onUrlChange={(url) => onChange({ ...data, imageUrl: url })}
      />
    </div>
  );
}

export function ConvenerEditor({
  data,
  onChange,
}: {
  data: ConvenerData;
  onChange: (d: ConvenerData) => void;
}) {
  const safeData: ConvenerData = {
    convener: { ...DEFAULT_CONVENER_DATA.convener, ...(data?.convener || {}) },
    coConvener: { ...DEFAULT_CONVENER_DATA.coConvener, ...(data?.coConvener || {}) },
  };

  return (
    <div className="space-y-6">
      <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl px-5 py-4 border border-primary/20">
        <p className="text-sm text-muted-foreground dark:text-muted-foreground">
          Edit the <strong>Convener</strong> and <strong>Co-Convener</strong> profiles displayed on the Home page. 
          Uploaded photos are stored on Cloudinary. Changes take effect after you click <strong>Save Changes</strong>.
        </p>
      </div>

      <PersonCard
        title="Convener"
        data={safeData.convener}
        onChange={(d) => onChange({ ...safeData, convener: d })}
      />
      <PersonCard
        title="Co-Convener"
        data={safeData.coConvener}
        onChange={(d) => onChange({ ...safeData, coConvener: d })}
      />
    </div>
  );
}
