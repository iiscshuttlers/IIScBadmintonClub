import { useEffect, useRef, useState } from "react";
import { Award, Download, Loader2, Share2, ShieldCheck, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  type CertificateInput,
  type Placement,
  certificateWording,
  drawCertificate,
  expandCategory,
  saveCertificatePdf,
  shareResultCard,
} from "@/lib/certificate";
import { issueCertificate } from "@/lib/certificateRegistry";

export function CertificateDialog({
  input,
  tournamentId,
  onClose,
}: {
  input: CertificateInput | null;
  tournamentId?: string;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "card" | null>(null);
  const [certCode, setCertCode] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setPreview(null);
    canvasRef.current = null;
    setCertCode(null);
    if (!input) return;
    let cancelled = false;

    (async () => {
      let code: string | undefined;
      if (tournamentId) {
        try {
          const issued = await issueCertificate(tournamentId, input);
          if (!cancelled) {
            code = issued.code;
            setCertCode(issued.code);
          }
        } catch { /* render without ID if issuance fails */ }
      }
      const certInput = code ? { ...input, certificateId: code } : input;
      const c = await drawCertificate(certInput);
      if (cancelled) return;
      canvasRef.current = c;
      setPreview(c.toDataURL("image/jpeg", 0.8));
    })();

    return () => { cancelled = true; };
  }, [input, tournamentId]);

  const run = async (kind: "pdf" | "card") => {
    if (!input) return;
    setBusy(kind);
    try {
      const certInput = certCode ? { ...input, certificateId: certCode } : input;
      if (kind === "pdf") await saveCertificatePdf(certInput, canvasRef.current ?? undefined);
      else await shareResultCard(certInput);
    } catch (e: any) {
      if (!/cancel/i.test(e?.message ?? "")) toast.error("Couldn't create the file. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const copyCode = () => {
    if (!certCode) return;
    navigator.clipboard.writeText(certCode);
    toast.success("Certificate ID copied");
  };

  return (
    <Dialog open={!!input} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" /> Certificate
          </DialogTitle>
          <DialogDescription>
            {input ? `${input.recipient} · ${certificateWording(input).highlight} · ${expandCategory(input.category)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-[1754/1240] w-full rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center">
          {preview ? (
            <img src={preview} alt="Certificate preview" className="w-full h-full object-contain" />
          ) : (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-label="Rendering certificate" />
          )}
        </div>
        {certCode && (
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-mono font-bold">{certCode}</span>
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">· Verify at /verify</span>
          </button>
        )}
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
