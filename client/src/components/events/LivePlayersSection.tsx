import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Users, Info, Image as ImageIcon, FileText } from "lucide-react";
import { safeReplaceState, safeGetSearchParams } from "@/lib/navUtils";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { getDepartmentAcronym } from "@/data/departments";

interface Participant {
  id: string;
  category: string;
  display_name: string | null;
  seed: number | null;
  custom_team_name?: string | null;
  player: { full_name: string | null; department: string | null } | null;
  partner: { full_name: string | null; department: string | null } | null;
}

export function LivePlayersSection({ 
  tournamentId, 
  categories,
  showParticipants 
}: { 
  tournamentId: string; 
  categories: string[];
  showParticipants?: boolean | null;
}) {
  const [participants, setParticipants] = useState<Record<string, Participant[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchParams = safeGetSearchParams();
  const [activeCat, setActiveCat] = useState<string>(searchParams.get("cat") || "");
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const exportAsImage = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    
    // Wait for the re-render to apply "exporting" styles
    await new Promise(r => setTimeout(r, 100));

    try {
      const dataUrl = await toPng(exportRef.current, { 
        cacheBust: true, 
        pixelRatio: 2,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc'
      });
      const link = document.createElement('a');
      link.download = `players-${activeCat}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (!activeCat || !participants[activeCat]) return;
    setExporting(true);
    try {
      const parts = participants[activeCat];
      const isDoubles = ["MD", "WD", "XD"].includes(activeCat);
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      let y = 40;
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Participants - ${activeCat}`, 40, y);
      y += 20;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      
      const lineH = 20;
      
      if (isDoubles) {
        pdf.setFont("helvetica", "bold");
        pdf.text("No.", 40, y);
        pdf.text("Player 1", 70, y);
        pdf.text("Dept 1", 230, y);
        pdf.text("Player 2", 330, y);
        pdf.text("Dept 2", 490, y);
        pdf.setFont("helvetica", "normal");
        y += 10;
        pdf.line(40, y, pageWidth - 40, y);
        y += 15;
      } else {
        pdf.setFont("helvetica", "bold");
        pdf.text("No.", 40, y);
        pdf.text("Name", 80, y);
        pdf.text("Department", 320, y);
        pdf.setFont("helvetica", "normal");
        y += 10;
        pdf.line(40, y, pageWidth - 40, y);
        y += 15;
      }
      
      parts.forEach((p, idx) => {
        if (y > pageHeight - 40) {
          pdf.addPage();
          y = 40;
        }
        
        const rowStr = `${idx + 1}`;
        if (isDoubles) {
          let p1Name = p.display_name?.split("&")[0]?.trim() || p.player?.full_name || "TBD";
          let p2Name = p.display_name?.split("&")[1]?.trim() || p.partner?.full_name || "TBD";
          let p1Dept = p.player?.department || p.custom_team_name || "EXT";
          let p2Dept = p.partner?.department || p.custom_team_name || "EXT";
          
          pdf.text(rowStr, 40, y);
          pdf.text(p1Name.substring(0, 25), 70, y);
          pdf.text(p1Dept.substring(0, 15), 230, y);
          pdf.text(p2Name.substring(0, 25), 330, y);
          pdf.text(p2Dept.substring(0, 15), 490, y);
        } else {
          let name = p.display_name || p.player?.full_name || "TBD";
          let dept = p.player?.department || p.custom_team_name || "EXT";
          
          pdf.text(rowStr, 40, y);
          pdf.text(name.substring(0, 45), 80, y);
          pdf.text(dept.substring(0, 40), 320, y);
        }
        
        y += lineH;
      });
      
      pdf.save(`players-${activeCat}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!showParticipants) {
      setError("The participants list has not been published yet.");
      setLoading(false);
      return;
    }

    supabase
      .from("tournament_participants")
      .select(`
        *,
        player:player_id (full_name, department),
        partner:partner_id (full_name, department)
      `)
      .eq("tournament_id", tournamentId)
      .order("category")
      .order("seed", { ascending: true })
      .then(({ data }) => {
        const grouped: Record<string, Participant[]> = {};
        for (const p of (data as any as Participant[]) || []) {
          if (!grouped[p.category]) grouped[p.category] = [];
          grouped[p.category].push(p);
        }
        
        // Randomize the order to hide seedings
        for (const cat in grouped) {
          grouped[cat].sort(() => Math.random() - 0.5);
        }
        
        setParticipants(grouped);
        
        // Auto-select first available category if activeCat is not set or not in valid categories
        const firstActive = categories.find((c) => grouped[c]?.length > 0);
        if (firstActive && (!activeCat || !grouped[activeCat])) {
          setActiveCat(firstActive);
        }
        
        setLoading(false);
      });
  }, [tournamentId, categories, activeCat]);

  useEffect(() => {
    if (!activeCat) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("cat", activeCat);
      safeReplaceState(url.toString());
    } catch { /* ignore on Capacitor */ }
  }, [activeCat]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-white/5 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700">
        <Users className="w-12 h-12 text-slate-300 dark:text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-black text-slate-800 dark:text-foreground">Participants Not Yet Available</h3>
        <p className="text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  const activeCategories = categories.filter((c) => participants[c]?.length > 0);

  if (activeCategories.length === 0) {
    return (
      <div className="text-center py-12 bg-white/5 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700">
        <Users className="w-12 h-12 text-slate-300 dark:text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-black text-slate-800 dark:text-foreground">No Players Registered Yet</h3>
        <p className="text-muted-foreground mt-1">Participants will appear here once they are added.</p>
      </div>
    );
  }

  const currentParticipants = participants[activeCat] || [];

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 pb-3">
        {activeCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={`px-4 py-2 rounded-full text-sm font-black whitespace-nowrap transition-all duration-300 ${
              activeCat === cat
                ? "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/50 scale-[1.02]"
                : "bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-on-accent ring-1 ring-inset ring-slate-200 dark:ring-slate-700/50"
            }`}
          >
            {cat} <span className={`text-[11px] ml-1 font-bold ${activeCat === cat ? "opacity-90" : "opacity-60"}`}>({participants[cat].length})</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary dark:text-primary" />
          <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground">
            Players are not listed in seeding order.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportAsImage} disabled={exporting} className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 hover:text-primary transition bg-slate-100 dark:bg-slate-800/60 px-2 py-1 rounded-md">
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />} Image
          </button>
          <button onClick={exportAsPDF} disabled={exporting} className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 hover:text-primary transition bg-slate-100 dark:bg-slate-800/60 px-2 py-1 rounded-md">
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />} PDF
          </button>
        </div>
      </div>

      <div ref={exportRef} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 bg-transparent p-1 -mx-1">
        {currentParticipants.map((p, i) => (
          <div 
            key={p.id}
            className={`group relative flex items-center justify-between p-5 rounded-[1.25rem] transition-all duration-300 overflow-hidden ${
              exporting 
                ? "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
                : "bg-white/80 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] dark:shadow-none hover:shadow-xl hover:-translate-y-1 hover:border-primary/40 dark:hover:border-primary/50"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            
            <div className="flex-1 flex flex-col min-w-0 pr-4 relative z-10">
              {(() => {
                if (p.display_name && p.display_name.includes("&")) {
                   const names = p.display_name.split("&").map(s => s.trim());
                   const name1 = names[0];
                   const name2 = names[1];
                   const dept1 = p.player?.department ? getDepartmentAcronym(p.player.department) : "EXT";
                   const dept2 = p.partner?.department ? getDepartmentAcronym(p.partner.department) : "EXT";
                   
                   return (
                     <div className="flex flex-col gap-3 w-full">
                       <div className="flex flex-col min-w-0">
                         <span className="font-black text-[14px] text-slate-800 dark:text-slate-100 truncate tracking-tight">{name1}</span>
                         <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate mt-0.5">{dept1}</span>
                       </div>
                       <div className="w-full h-px bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700/50" />
                       <div className="flex flex-col min-w-0">
                         <span className="font-black text-[14px] text-slate-800 dark:text-slate-100 truncate tracking-tight">{name2 || "partner"}</span>
                         <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate mt-0.5">{dept2}</span>
                       </div>
                     </div>
                   );
                } else {
                   const dept = p.player?.department ? getDepartmentAcronym(p.player.department) : p.custom_team_name ? getDepartmentAcronym(p.custom_team_name) : "EXT";
                   return (
                     <div className="flex flex-col">
                        <span className="font-black text-[15px] text-slate-800 dark:text-slate-100 truncate tracking-tight mb-1">
                          {p.display_name || p.player?.full_name || "Unknown Player"}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                          {dept}
                        </span>
                     </div>
                   );
                }
              })()}
            </div>
            
            <div className="flex-shrink-0 relative z-10 flex flex-col items-end justify-center self-stretch ml-2">
              <span className="text-[32px] font-black leading-none text-slate-200/80 dark:text-slate-700/40 group-hover:text-primary/30 dark:group-hover:text-primary/30 transition-colors duration-300">
                #{i + 1}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
