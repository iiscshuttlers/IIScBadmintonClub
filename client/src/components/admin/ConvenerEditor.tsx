import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, User, X, Link2, Unlink, PenLine } from "lucide-react";
import { toast } from "sonner";
import { PlayerSelect } from "@/components/ui/PlayerSelect";
import {
  type ConvenerData,
  type ConvenerPerson,
  type ConvenerRole,
  type LinkedPlayer,
  CONVENER_ROLES,
  bundledConvenerAssets,
  fetchConvenerPlayers,
  normaliseConvenerData,
  sameName,
} from "@/lib/conveners";

const inputCls =
  "w-full px-3 py-2.5 rounded-xl border border-border-strong bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition disabled:opacity-70";
const labelCls =
  "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

function ImageUploadField({
  title,
  currentUrl,
  fallbackUrl,
  fallbackNote,
  folder,
  wide = false,
  onUrlChange,
}: {
  title: string;
  currentUrl: string;
  /** Shown when no custom image is set (profile photo or bundled file). */
  fallbackUrl?: string;
  /** Says where the preview comes from, or what happens with no image. */
  fallbackNote?: string;
  folder: string;
  /** Signature strip instead of a square photo. */
  wide?: boolean;
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
      setPreview(URL.createObjectURL(file));

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", folder);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formData }
      );
      const json = await res.json();

      if (!res.ok || !json.secure_url) {
        throw new Error(json.error?.message || "Upload failed");
      }

      onUrlChange(json.secure_url);
      toast.success(`${title} uploaded`);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = preview || currentUrl || fallbackUrl || "";
  const boxCls = wide
    ? "w-40 h-20 rounded-xl bg-[white]" // raw-color-ok: signatures are dark ink, previewed on paper
    : "w-20 h-20 rounded-2xl bg-muted";

  return (
    <div className="space-y-3">
      <p className={labelCls}>{title}</p>

      <div className="flex items-center gap-4">
        <div className={`relative ${boxCls} border-2 border-dashed border-border-strong overflow-hidden flex items-center justify-center shrink-0`}>
          {displayUrl ? (
            <img src={displayUrl} alt={title} className={`w-full h-full ${wide ? "object-contain p-1" : "object-cover"}`} />
          ) : wide ? (
            <PenLine className="w-7 h-7 text-muted-foreground" />
          ) : (
            <User className="w-8 h-8 text-muted-foreground" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-media/50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-foreground animate-spin" />
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
            {uploading ? "Uploading..." : "Upload"}
          </button>

          {currentUrl && (
            <button
              type="button"
              onClick={() => { onUrlChange(""); setPreview(null); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-danger hover:bg-danger/10 text-xs font-bold transition"
            >
              <X className="w-3 h-3" /> Remove
            </button>
          )}
        </div>
      </div>

      {!currentUrl && !preview && fallbackNote && (
        <p className="text-xs text-muted-foreground">{fallbackNote}</p>
      )}

      <div>
        <label className={labelCls}>Or paste image URL</label>
        <input
          className={inputCls}
          type="url"
          placeholder="https://..."
          value={currentUrl}
          onChange={(e) => { setPreview(null); onUrlChange(e.target.value); }}
        />
      </div>

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
  players,
  playersLoading,
  onChange,
}: {
  title: string;
  data: ConvenerPerson;
  players: LinkedPlayer[];
  playersLoading: boolean;
  onChange: (d: ConvenerPerson) => void;
}) {
  const linked = data.playerId ? players.find((p) => p.id === data.playerId) : undefined;
  const bundled = bundledConvenerAssets(linked?.full_name, data.name);

  const pickPlayer = (id: string) => {
    // PlayerSelect sends "" on every keystroke; only a real pick changes the link.
    if (!id || id === data.playerId) return;
    const p = players.find((x) => x.id === id);
    if (!p) return;
    if (sameName(p.full_name, data.name)) {
      onChange({ ...data, playerId: p.id, name: p.full_name });
      return;
    }
    // A different person: the old photo and signature belong to someone else.
    onChange({ ...data, playerId: p.id, name: p.full_name, imageUrl: "", signatureUrl: "" });
    toast.info(`Upload ${p.full_name}'s signature for certificates`);
  };

  const photoFallback = linked?.avatar_url || bundled?.photo || "";
  const photoNote = linked?.avatar_url
    ? "Using their profile photo."
    : bundled?.photo
      ? "Using the built-in photo."
      : "No photo yet: their initials are shown.";
  const signatureNote = bundled?.signature
    ? "Using the built-in signature."
    : "No signature yet: certificates show the name in script instead.";

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
      <h3 className="text-base font-black text-foreground flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary inline-block" />
        {title}
      </h3>

      <div>
        <label className={labelCls}>Player profile</label>
        {playersLoading ? (
          <div className={`${inputCls} flex items-center gap-2 text-muted-foreground`}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading players…
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <PlayerSelect
                value={linked?.id ?? ""}
                onChange={pickPlayer}
                players={players}
                placeholder="Search a player to link…"
                className={inputCls}
              />
            </div>
            {data.playerId && (
              <button
                type="button"
                onClick={() => onChange({ ...data, playerId: undefined })}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition"
                aria-label={`Unlink ${title} from the player profile`}
              >
                <Unlink className="w-3.5 h-3.5" /> Unlink
              </button>
            )}
          </div>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
          {linked ? (
            <><Link2 className="w-3.5 h-3.5 text-primary" /> Name and photo come from their profile, and the name links to it.</>
          ) : data.playerId && !playersLoading ? (
            "The linked player no longer exists. Pick another player or unlink."
          ) : (
            "Not linked: the name below is shown as plain text."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Name</label>
          <input
            className={inputCls}
            value={linked ? linked.full_name : data.name}
            disabled={!!linked}
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
        title={`${title} photo`}
        folder="conveners"
        currentUrl={data.imageUrl}
        fallbackUrl={photoFallback}
        fallbackNote={photoNote}
        onUrlChange={(url) => onChange({ ...data, imageUrl: url })}
      />

      <ImageUploadField
        title={`${title} signature (certificates)`}
        folder="signatures"
        wide
        currentUrl={data.signatureUrl ?? ""}
        fallbackUrl={bundled?.signature}
        fallbackNote={`${signatureNote} Use dark ink on white paper or a transparent PNG.`}
        onUrlChange={(url) => onChange({ ...data, signatureUrl: url })}
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
  const [players, setPlayers] = useState<LinkedPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchConvenerPlayers()
      .then((list) => { if (!cancelled) setPlayers(list); })
      .catch(() => { if (!cancelled) toast.error("Couldn't load players to link"); })
      .finally(() => { if (!cancelled) setPlayersLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const safeData = normaliseConvenerData(data);

  return (
    <div className="space-y-6">
      <div className="bg-primary/10 rounded-2xl px-5 py-4 border border-primary/20">
        <p className="text-sm text-muted-foreground">
          The <strong>Convener</strong> and <strong>Co-Convener</strong> appear under Club Leadership on the
          Club → About tab, and their names and signatures are printed on tournament certificates.
          Link each one to a player profile so the name stays current and opens their profile.
          Uploads are stored on Cloudinary. Changes take effect after you click <strong>Save Changes</strong>.
        </p>
      </div>

      {CONVENER_ROLES.map(({ key, title }) => (
        <PersonCard
          key={key}
          title={title}
          data={safeData[key]}
          players={players}
          playersLoading={playersLoading}
          onChange={(d) => onChange({ ...safeData, [key]: d } as Record<ConvenerRole, ConvenerPerson>)}
        />
      ))}
    </div>
  );
}
