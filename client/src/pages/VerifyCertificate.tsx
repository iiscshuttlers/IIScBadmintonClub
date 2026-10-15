import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldX, Search, Loader2 } from "lucide-react";
import { verifyCertificate, type VerifiedCertificate } from "@/lib/certificateRegistry";
import { PLACEMENT_META, expandCategory, formatCertDate } from "@/lib/certificate";

function CertificateResult({ cert }: { cert: VerifiedCertificate }) {
  const meta = PLACEMENT_META[cert.placement];
  return (
    <div className="rounded-3xl border-2 border-emerald-500/40 bg-emerald-500/5 p-6 text-center space-y-4">
      <div className="flex justify-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-emerald-500" />
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Verified Certificate</p>
        <p className="text-xs text-muted-foreground mt-1">{cert.code}</p>
      </div>
      <div className="space-y-1">
        <p className="text-2xl">{meta.medal}</p>
        <p className="text-xl font-black">{cert.recipient}</p>
        <p className="text-sm font-bold" style={{ color: meta.color }}>{meta.title}</p>
      </div>
      <div className="text-sm text-muted-foreground space-y-0.5">
        <p className="font-bold text-foreground">{expandCategory(cert.category)}</p>
        <p>{cert.tournament_name}</p>
        {cert.event_date && <p>{formatCertDate(cert.event_date)}</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        Issued {new Date(cert.issued_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
      </p>
    </div>
  );
}

function NotFound({ code }: { code: string }) {
  return (
    <div className="rounded-3xl border-2 border-red-500/30 bg-red-500/5 p-6 text-center space-y-3">
      <div className="flex justify-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
          <ShieldX className="w-7 h-7 text-red-500" />
        </div>
      </div>
      <p className="font-bold text-red-600 dark:text-red-400">Certificate not found</p>
      <p className="text-sm text-muted-foreground">
        No certificate with code <span className="font-mono font-bold">{code}</span> exists in our records.
      </p>
    </div>
  );
}

export default function VerifyCertificate() {
  const [, params] = useRoute<{ code: string }>("/verify/:code");
  const codeFromUrl = (params?.code ?? "").toUpperCase();
  const [input, setInput] = useState(codeFromUrl);
  const [searchCode, setSearchCode] = useState(codeFromUrl);

  const { data, isLoading, isFetched } = useQuery({
    queryKey: ["verify-certificate", searchCode],
    enabled: !!searchCode,
    queryFn: () => verifyCertificate(searchCode),
    staleTime: 60_000,
    retry: 1,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim().toUpperCase();
    if (trimmed) setSearchCode(trimmed);
  };

  return (
    <div className="min-h-[60vh] flex items-start justify-center px-4 pt-12 pb-20">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black">Verify Certificate</h1>
          <p className="text-sm text-muted-foreground">
            Enter the certificate ID printed on your IISc Badminton Club certificate to verify its authenticity.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="IISC-XXXXXX"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 font-mono text-sm font-bold placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus={!codeFromUrl}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 font-bold disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </form>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {isFetched && !isLoading && data && <CertificateResult cert={data} />}
        {isFetched && !isLoading && !data && searchCode && <NotFound code={searchCode} />}
      </div>
    </div>
  );
}
