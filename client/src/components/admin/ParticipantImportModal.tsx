import React, { useState } from "react";
import { toast } from "sonner";
import { bulkImportParticipants } from "@/services/tournamentService";
import { Download, Upload, Clipboard, X, Loader2 } from "lucide-react";
import { downloadCSV, readCSVFile } from "@/utils/csvUtils";
import type { Tournament } from "@/types/tournament";

export interface ParticipantImportModalProps {
  tournament: Tournament;
  activeCategory: string | null;
  adminPlayers: any[];
  isDoubles: (cat: string) => boolean;
  onClose: () => void;
  onImportComplete: () => Promise<void>;
}

export function ParticipantImportModal({
  tournament,
  activeCategory,
  adminPlayers,
  isDoubles,
  onClose,
  onImportComplete,
}: ParticipantImportModalProps) {
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);

  const matchPlayer = (name: string, personal: string, iisc: string) => {
    if (!name && !personal && !iisc) return null;
    return adminPlayers.find(p => {
      if (name && p.full_name && p.full_name.toLowerCase() === name.toLowerCase()) return true;
      if (personal && p.email && p.email.toLowerCase() === personal.toLowerCase()) return true;
      if (iisc && p.iisc_email && p.iisc_email.toLowerCase() === iisc.toLowerCase()) return true;
      if (personal && p.iisc_email && p.iisc_email.toLowerCase() === personal.toLowerCase()) return true;
      if (iisc && p.email && p.email.toLowerCase() === iisc.toLowerCase()) return true;
      return false;
    }) ?? null;
  };

  const isPhone = (s: string) => /^\d{7,15}$/.test(s.replace(/[\s\-+()]/g, ""));

  const parseBulkLines = (text: string, cat: string) => {
    const doubles = isDoubles(cat);
    const isHeaderRow = (l: string) => /^player\s*(1\s*)?name[\t,]/i.test(l);
    return text.split("\n").map((line) => line.trim()).filter(Boolean).filter(l => !isHeaderRow(l)).map((line) => {
      if (doubles) {
        const rawParts = line.includes("\t") ? line.split("\t").map(s => s.trim())
          : line.includes(",") ? line.split(",").map(s => s.trim())
          : line.split(/\s*&\s*/).map(s => s.trim());
        const validParts = rawParts.filter(Boolean);

        let name1 = "", name2 = "", email1 = "", email2 = "", phone1 = "", phone2 = "";
        const tbd = /^(na|n\/a|tbd|ytd|tba|-|none)$/i;
        const clean = (v: string) => tbd.test(v) ? "" : v;
        if (validParts.length >= 4) {
           const emails = validParts.filter(p => p.includes("@"));
           const phones = validParts.filter(p => isPhone(p));
           const names = validParts.filter(p => !p.includes("@") && !isPhone(p) && !/^\d+$/.test(p)).map(clean).filter(Boolean);
           name1 = names[0] || "";
           name2 = names[1] || "";
           email1 = emails[0] || "";
           email2 = emails[1] || "";
           phone1 = phones[0] || "";
           phone2 = phones[1] || "";
        } else {
           for (const p of validParts) {
             if (p.includes("@")) { if (!email1) email1 = p; else if (!email2) email2 = p; }
             else if (isPhone(p)) { if (!phone1) phone1 = p; else if (!phone2) phone2 = p; }
             else { const c = clean(p); if (c) { if (!name1) name1 = c; else if (!name2) name2 = c; } }
           }
        }

        if (!email1.includes("@")) email1 = "";
        if (!email2.includes("@")) email2 = "";
        const match1 = matchPlayer(name1, email1, email1) || (adminPlayers.find(p => name1 && p.full_name.toLowerCase() === name1.toLowerCase()) ?? null);
        const match2 = name2 ? (matchPlayer(name2, email2, email2) || (adminPlayers.find(p => name2 && p.full_name.toLowerCase() === name2.toLowerCase()) ?? null)) : null;
        const seedPart = validParts.find(p => /^\d{1,3}$/.test(p) && !isPhone(p) && !p.includes("@"));
        return { raw: line, name1, name2, email1, email2, phone1, phone2, match1, match2, seed: seedPart ? parseInt(seedPart, 10) : null };
      } else {
        const sep = line.includes("\t") ? "\t" : ",";
        const parts = line.split(sep).map(s => s.trim()).filter(Boolean);
        let name = "", email = "", phone1 = "", parsedSeed: number | null = null;
        for (const p of parts) {
          if (p.includes("@")) { if (!email) email = p; }
          else if (isPhone(p) && !phone1) { phone1 = p; }
          else if (/^\d{1,3}$/.test(p) && parsedSeed === null) { parsedSeed = parseInt(p, 10); }
          else { if (!name) name = p; }
        }

        if (/^(na|n\/a|tbd|ytd|tba|-|none)$/i.test(name)) name = "";
        const match = matchPlayer(name, email, email) || (adminPlayers.find(p => name && p.full_name.toLowerCase() === name.toLowerCase()) ?? null);
        return { raw: line, name1: name, name2: "", email1: email, email2: "", phone1, phone2: "", match1: match, match2: null, seed: parsedSeed };
      }
    });
  };

  const downloadParticipantTemplate = (cat: string) => {
    const doubles = isDoubles(cat);
    const header = doubles
      ? ["Player1 Name", "Player1 Email", "Player1 Phone", "Player2 Name", "Player2 Email", "Player2 Phone", "Seed"]
      : ["Player Name", "Email", "Phone", "Seed"];
    const examples = doubles
      ? [["Rahul Sharma", "rahul@iisc.ac.in", "9876543210", "Priya Nair", "priya@iisc.ac.in", "9123456789", "1"]]
      : [["Rahul Sharma", "rahul@iisc.ac.in", "9876543210", "1"]];
    downloadCSV(`${cat}_participants_template.csv`, [header, ...examples]);
  };

  const handleParticipantCSV = async (cat: string, file: File) => {
    const rows = await readCSVFile(file);
    const doubles = isDoubles(cat);
    const dataRows = rows[0]?.[0]?.toLowerCase().match(/^(player|name)/) ? rows.slice(1) : rows;
    const lines = dataRows.map((r) => {
      if (doubles) {
        return [r[0] ?? "", r[1] ?? "", r[2] ?? "", r[3] ?? "", r[4] ?? "", r[5] ?? "", r[6] ?? ""].join("\t");
      } else {
        return [r[0] ?? "", r[1] ?? "", r[2] ?? "", r[3] ?? ""].join("\t");
      }
    }).filter(line => line.replace(/\t/g, '').trim().length > 0);
    setBulkText(lines.join("\n"));
  };

  const runBulkImport = async () => {
    if (!activeCategory) return;
    const entries = parseBulkLines(bulkText, activeCategory);
    if (!entries.length) return;
    setBulkImporting(true);

    try {
      const preparedEntries = entries.filter((e) => !!e.name1).map((entry) => {
        const playerId = entry.match1?.id ?? null;
        const partnerId = entry.match2?.id ?? null;
        const displayName = isDoubles(activeCategory)
          ? (entry.name2 ? `${entry.name1} & ${entry.name2}` : entry.name1)
          : entry.name1;
        const entryEmail = entry.email1 || entry.email2 || null;

        return {
          playerId,
          partnerId,
          displayName: displayName || null,
          seed: entry.seed ?? null,
          email: entryEmail,
          phone1: entry.phone1,
          phone2: entry.phone2,
        };
      });

      await bulkImportParticipants({
        tournamentId: tournament.id,
        category: activeCategory,
        entries: preparedEntries,
      });

      toast.success(`${entries.length} participant(s) imported`);
      await onImportComplete();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Import failed");
    } finally {
      setBulkImporting(false);
    }
  };

  if (!activeCategory) return null;
  const entries = bulkText.trim() ? parseBulkLines(bulkText, activeCategory) : [];

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-muted-foreground">
          Paste names — one per line.
          {isDoubles(activeCategory) && ' For doubles, use two columns (tab-separated) or "Name1 & Name2".'}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={async () => {
              try {
                if (navigator.clipboard?.readText) {
                  const text = await navigator.clipboard.readText();
                  if (text) { setBulkText(p => p ? p + "\n" + text : text); return; }
                }
              } catch {
                /* intentional — clipboard permission denied or unsupported in current browser */
              }
              toast("Long-press the text box and use your device's Paste", { icon: "📋" });
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-black text-[var(--info)] hover:text-[var(--info)] hover:border-[var(--info)] transition"
          >
            <Clipboard className="w-3 h-3" /> Paste
          </button>
          <button
            onClick={() => downloadParticipantTemplate(activeCategory)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-black text-muted-foreground hover:text-primary hover:border-primary transition"
          >
            <Download className="w-3 h-3" /> CSV Template
          </button>
        </div>
      </div>
      <textarea
        autoFocus
        rows={6}
        value={bulkText}
        onChange={(e) => setBulkText(e.target.value)}
        placeholder={isDoubles(activeCategory) ? "Rahul Sharma\tPriya Nair\nArun K\tMeena R" : "Rahul Sharma\nPriya Nair\nArun Kumar"}
        className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-primary resize-none"
      />
      <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-[var(--info)] transition w-fit">
        <Upload className="w-3.5 h-3.5" />
        <span>Upload CSV instead</span>
        <input type="file" accept=".csv" className="hidden"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleParticipantCSV(activeCategory, f); e.target.value = ""; }} />
      </label>
      {entries.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {entries.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${e.match1 ? "bg-primary" : "bg-[var(--warning)]"}`} />
              <span className="flex-1 truncate">
                <span className="font-bold text-slate-800 dark:text-foreground">{e.name1}</span>
                {e.email1 && <span className="text-slate-400 dark:text-slate-500 ml-1">{e.email1}</span>}
                {e.phone1 && <span className="text-emerald-500 ml-1">{e.phone1}</span>}
                {e.name2 && <><span className="text-muted-foreground mx-1">&</span><span className="font-bold text-slate-800 dark:text-foreground">{e.name2}</span></>}
                {e.email2 && <span className="text-slate-400 dark:text-slate-500 ml-1">{e.email2}</span>}
                {e.phone2 && <span className="text-emerald-500 ml-1">{e.phone2}</span>}
              </span>
              <span className={`text-[10px] font-black uppercase ${e.match1 ? "text-primary" : "text-[var(--warning)]"}`}>
                {e.match1 ? "Found" : "External"}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button
          disabled={bulkImporting || !bulkText.trim()}
          onClick={runBulkImport}
          className="flex-1 bg-primary text-primary-foreground text-xs font-black py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
        >
          {bulkImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          <span>{bulkImporting ? "Importing..." : "Run Import"}</span>
        </button>
        <button onClick={onClose} className="px-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black py-2 rounded-lg transition">Cancel</button>
      </div>
    </div>
  );
}
