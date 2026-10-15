import { useEffect, useRef, useState } from "react";
import { Award, Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  type CertificateInput,
  type Placement,
  PLACEMENT_META,
  drawCertificate,
  saveCertificatePdf,
  shareResultCard,
} from "@/lib/certificate";

/**
 * Preview + export for a podium finisher: A4 certificate (PDF) or a square
 * result card (image) for WhatsApp/Instagram.
 */
export function CertificateDialog({
  input,
  onClose,
}: {
  input: CertificateInput | null;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "card" | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setPreview(null);
    canvasRef.current = null;
    if (!input) return;
    let cancelled = false;
    drawCertificate(input).then((c) => {
      if (cancelled) return;
      canvasRef.current = c;
      setPreview(c.toDataURL("image/jpeg", 0.8));
    });
    return () => {
      cancelled = true;
    };
  }, [input]);

  const run = async (kind: "pdf" | "card") => {
    if (!input) return;
    setBusy(kind);
    try {
      if (kind === "pdf") await saveCertificatePdf(input, canvasRef.current ?? undefined);
      else await shareResultCard(input);
    } catch (e: any) {
      if (!/cancel/i.test(e?.message ?? "")) toast.error("Couldn't create the file. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={!!input} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" /> Certificate
          </DialogTitle>
          <DialogDescription>
            {input ? `${input.recipient} · ${PLACEMENT_META[input.placement].title} · ${input.category}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-[1754/1240] w-full rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center">
          {preview ? (
            <img src={preview} alt="Certificate preview" className="w-full h-full object-contain" />
          ) : (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-label="Rendering certificate" />
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => run("pdf")}
            disabled={!preview || !!busy}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-bold py-2.5 disabled:opacity-60"
          >
            {busy === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Certificate (PDF)
          </button>
          <button
            type="button"
            onClick={() => run("card")}
            disabled={!!busy}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border font-bold py-2.5 hover:bg-muted disabled:opacity-60"
          >
            {busy === "card" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Share result card
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small inline trigger shown next to a podium name. */
export function CertificateButton({
  recipient,
  placement,
  onOpen,
}: {
  recipient: string;
  placement: Placement;
  onOpen: (recipient: string, placement: Placement) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(recipient, placement)}
      aria-label={`Certificate for ${recipient}`}
      title="Certificate & share card"
      className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
    >
      <Award className="w-4 h-4" />
    </button>
  );
}
