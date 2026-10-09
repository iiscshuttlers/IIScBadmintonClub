import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, Link } from 'wouter';
import { UploadCloud, CheckCircle2, ChevronRight, ChevronLeft, Download, Eye, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { usePageMeta } from '@/hooks/usePageMeta';
import { toast } from 'sonner';
import { TeamFormatConfigPanel, RubberConfig } from '@/components/admin/TeamFormatConfigPanel';

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -15 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

export default function HostTournamentWizard() {
  usePageMeta({
    title: "Host a tournament",
    description: "Create and run your own badminton tournament, powered by UmpireApp.",
  });

  const { session, isAdmin } = useAuth();
  const [, navigate] = useLocation();

  // Persist state in localStorage
  const loadState = (key: string, defaultValue: any) => {
    const saved = localStorage.getItem(`wizard_${key}`);
    return saved ? JSON.parse(saved) : defaultValue;
  };

  const [step, setStep] = useState(() => loadState('step', 1));
  const [name, setName] = useState(() => loadState('name', ''));
  const [location, setLocation] = useState(() => loadState('location', ''));
  const [formatFamily, setFormatFamily] = useState<'TEAM' | 'OPEN_EVENT'>(() => loadState('formatFamily', 'TEAM'));
  const [format, setFormat] = useState(() => loadState('format', 'standard'));
  const [lineupEntry, setLineupEntry] = useState<'CAPTAINS' | 'HOST'>(() => loadState('lineupEntry', 'CAPTAINS'));
  const [countsForElo, setCountsForElo] = useState<boolean>(() => loadState('countsForElo', true));
  const [ignoreGenderRules, setIgnoreGenderRules] = useState<boolean>(() => loadState('ignoreGenderRules', false));
  const [playDeadRubbers, setPlayDeadRubbers] = useState<boolean>(() => loadState('playDeadRubbers', true));
  
  const [customRubbers, setCustomRubbers] = useState<RubberConfig[]>(() => loadState('customRubbers', []));
  const [teamRosterMin, setTeamRosterMin] = useState<number>(() => loadState('teamRosterMin', 4));
  const [teamRosterMax, setTeamRosterMax] = useState<number>(() => loadState('teamRosterMax', 10));
  const [tiePointsWin, setTiePointsWin] = useState<number>(() => loadState('tiePointsWin', 2));
  const [tiePointsDraw, setTiePointsDraw] = useState<number>(() => loadState('tiePointsDraw', 1));

  const [file, setFile] = useState<File | null>(null);
  const [parsedTeams, setParsedTeams] = useState<number>(0);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('wizard_step', JSON.stringify(step));
    localStorage.setItem('wizard_name', JSON.stringify(name));
    localStorage.setItem('wizard_location', JSON.stringify(location));
    localStorage.setItem('wizard_formatFamily', JSON.stringify(formatFamily));
    localStorage.setItem('wizard_format', JSON.stringify(format));
    localStorage.setItem('wizard_lineupEntry', JSON.stringify(lineupEntry));
    localStorage.setItem('wizard_countsForElo', JSON.stringify(countsForElo));
    localStorage.setItem('wizard_ignoreGenderRules', JSON.stringify(ignoreGenderRules));
    localStorage.setItem('wizard_playDeadRubbers', JSON.stringify(playDeadRubbers));
    
    localStorage.setItem('wizard_customRubbers', JSON.stringify(customRubbers));
    localStorage.setItem('wizard_teamRosterMin', JSON.stringify(teamRosterMin));
    localStorage.setItem('wizard_teamRosterMax', JSON.stringify(teamRosterMax));
    localStorage.setItem('wizard_tiePointsWin', JSON.stringify(tiePointsWin));
    localStorage.setItem('wizard_tiePointsDraw', JSON.stringify(tiePointsDraw));
  }, [step, name, location, formatFamily, format, lineupEntry, countsForElo, ignoreGenderRules, playDeadRubbers, customRubbers, teamRosterMin, teamRosterMax, tiePointsWin, tiePointsDraw]);

  const parseCsvText = (text: string, filename: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const parsed = lines.map(l => l.split(','));
    const dataRows = parsed.slice(1);
    if (formatFamily === 'OPEN_EVENT') {
      setParsedTeams(dataRows.length);
    } else {
      const uniqueTeams = Array.from(new Set(dataRows.map(r => r[0]?.trim()).filter(Boolean)));
      setParsedTeams(uniqueTeams.length);
    }
    setPreviewData(parsed);
    setFile(new File([text], filename, { type: 'text/csv' }));
    toast.success("CSV loaded successfully");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (uploaded) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseCsvText(text, uploaded.name);
      };
      reader.readAsText(uploaded);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = formatFamily === 'OPEN_EVENT'
      ? "data:text/csv;charset=utf-8,category,player1_name,player2_name,seed\nMS,John Doe,,1\nWS,Jane Smith,,\nMD,John Doe,Sam Lee,\nXD,John Doe,Jane Smith,2"
      : "data:text/csv;charset=utf-8,team_name,player_name,gender\nTeam Alpha,John Doe,M\nTeam Alpha,Jane Smith,F";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", formatFamily === 'OPEN_EVENT' ? "entrants_template.csv" : "roster_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isStep1Valid = name.trim().length > 0 && location.trim().length > 0;
  
  const handleNext = () => {
    if (step === 1 && !isStep1Valid) return;
    if (step === 4) {
      handlePublish();
    } else {
      setStep(Math.min(4, step + 1));
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      if (!session?.user?.id) {
        toast.error("You must be logged in to create a tournament");
        setIsPublishing(false);
        return;
      }
      
      const payload: any = {
        name,
        venue: location,
        tournament_type: formatFamily === 'TEAM' ? 'team' : 'open',
        bracket_format: 'single_elimination',
        status: 'draft',
        created_by: session.user.id,
        year: new Date().getFullYear(),
        categories: ['MS', 'WS', 'MD', 'WD', 'XD'],
        description: `Format: ${formatFamily === 'TEAM' ? (format === 'standard' ? 'BWF Standard' : 'Custom Format') : 'Open Event'}`,
        format_family: formatFamily
      };

      if (formatFamily === 'TEAM') {
        payload.counts_for_elo = countsForElo;
        payload.ignore_gender_rules = ignoreGenderRules;
        payload.play_dead_rubbers = playDeadRubbers;
        payload.max_rubbers_per_player = 2; // Fixed for now, can be added to config later
        
        if (format === 'standard') {
          payload.team_roster_min = 4;
          payload.team_roster_max = 10;
          payload.tie_points_win = 2;
          payload.tie_points_draw = 1;
          payload.tie_format_config = {
            rubbers: [
              { order: 1, label: 'MS1', category: 'MS', points: 1, best_of_sets: 3, points_to_win: 21 },
              { order: 2, label: 'WS1', category: 'WS', points: 1, best_of_sets: 3, points_to_win: 21 },
              { order: 3, label: 'MD1', category: 'MD', points: 1, best_of_sets: 3, points_to_win: 21 },
              { order: 4, label: 'WD1', category: 'WD', points: 1, best_of_sets: 3, points_to_win: 21 },
              { order: 5, label: 'XD1', category: 'XD', points: 1, best_of_sets: 3, points_to_win: 21 }
            ],
            play_dead_rubbers: playDeadRubbers,
            draw_allowed: false
          };
        } else {
          payload.team_roster_min = teamRosterMin;
          payload.team_roster_max = teamRosterMax;
          payload.tie_points_win = tiePointsWin;
          payload.tie_points_draw = tiePointsDraw;
          payload.tie_format_config = {
            rubbers: customRubbers,
            play_dead_rubbers: playDeadRubbers,
            draw_allowed: true // Or calculate based on points
          };
        }
      }

      const { data, error } = await supabase.from('tournaments').insert(payload).select().single();
      
      if (error) throw error;
      
      // Cleanup
      ['wizard_step', 'wizard_name', 'wizard_location', 'wizard_formatFamily', 'wizard_format', 'wizard_lineupEntry', 'wizard_countsForElo', 'wizard_ignoreGenderRules', 'wizard_playDeadRubbers', 'wizard_customRubbers', 'wizard_teamRosterMin', 'wizard_teamRosterMax', 'wizard_tiePointsWin', 'wizard_tiePointsDraw']
        .forEach(k => localStorage.removeItem(k));
        
      toast.success("Tournament created successfully!");
      navigate('/admin');
      
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to create tournament.');
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 sticky top-0 z-10 shadow-sm">
        <Link href="/host-tournament">
          <button className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-sm font-black text-foreground truncate">Host a tournament</h1>
          <p className="text-xs text-muted-foreground truncate">Native Wizard</p>
        </div>
      </div>
      
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 mb-6">Create Tournament</h1>
        
        {/* Stepper */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`flex-1 h-2 rounded-full transition-all duration-300 ${s <= step ? 'bg-primary shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.5)]' : 'bg-slate-200 dark:bg-slate-800'}`} />
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xl relative min-h-[400px] flex flex-col">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <PageTransition key="step1">
                <h2 className="text-xl font-black mb-6">1. Basic Info</h2>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">Tournament Name *</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none transition"
                      placeholder="e.g. All England Open 2026"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">Location *</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none transition"
                      placeholder="Arena Name"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                    />
                  </div>
                  <div className="pt-2">
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-3">Tournament Type *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div 
                          onClick={() => setFormatFamily('TEAM')}
                          className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${formatFamily === 'TEAM' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                        >
                          <h3 className={`font-black text-lg mb-1 flex items-center justify-between ${formatFamily === 'TEAM' ? 'text-primary' : 'text-slate-800 dark:text-slate-200'}`}>
                            Team Tie
                            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">New</span>
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Teams face off in ties (MS/WS/MD/WD/XD rubbers).</p>
                        </div>
                      <div 
                        onClick={() => setFormatFamily('OPEN_EVENT')}
                        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${formatFamily === 'OPEN_EVENT' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                      >
                        <h3 className={`font-black text-lg mb-1 ${formatFamily === 'OPEN_EVENT' ? 'text-primary' : 'text-slate-800 dark:text-slate-200'}`}>Open Event</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Individual knockout draw per category.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </PageTransition>
            )}

            {step === 2 && formatFamily === 'OPEN_EVENT' && (
              <PageTransition key="step2-open">
                <h2 className="text-xl font-black mb-6">2. Open Event Format</h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                  Open events don't use rubber/tie configuration — each category (MS, WS, MD, WD, XD) runs its own
                  independent single-elimination bracket. Which categories run is determined by the entrants you
                  import in the next step; you can generate a seeded bracket per category from the dashboard once
                  the tournament is live.
                </p>

                <div className="mt-8 space-y-4">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">Event Rules</h3>
                  <label className="flex items-center gap-3 p-4 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <input type="checkbox" checked={countsForElo} onChange={e => setCountsForElo(e.target.checked)} className="w-5 h-5 accent-primary" />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Count for ELO</div>
                      <div className="text-xs text-slate-500">Matches will update players' personal and category ELO. Uncheck for casual tournaments.</div>
                    </div>
                  </label>
                </div>
              </PageTransition>
            )}

            {step === 2 && formatFamily === 'TEAM' && (
              <PageTransition key="step2-team">
                <h2 className="text-xl font-black mb-6">2. Select Format</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div 
                    onClick={() => setFormat('standard')}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${format === 'standard' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                  >
                    <h3 className={`font-black text-lg mb-1 ${format === 'standard' ? 'text-primary' : 'text-slate-800 dark:text-slate-200'}`}>BWF Standard</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">5 Matches (MS, WS, MD, WD, XD)</p>
                  </div>
                  <div 
                    onClick={() => setFormat('custom')}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${format === 'custom' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                  >
                    <h3 className={`font-black text-lg mb-1 ${format === 'custom' ? 'text-primary' : 'text-slate-800 dark:text-slate-200'}`}>Custom Format</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Configure custom match rules</p>
                  </div>
                </div>

                {format === 'custom' && (
                  <TeamFormatConfigPanel 
                    rubbers={customRubbers}
                    setRubbers={setCustomRubbers}
                    teamRosterMin={teamRosterMin}
                    setTeamRosterMin={setTeamRosterMin}
                    teamRosterMax={teamRosterMax}
                    setTeamRosterMax={setTeamRosterMax}
                    tiePointsWin={tiePointsWin}
                    setTiePointsWin={setTiePointsWin}
                    tiePointsDraw={tiePointsDraw}
                    setTiePointsDraw={setTiePointsDraw}
                  />
                )}
                
                <div className="mt-8 space-y-4">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">Event Rules</h3>
                  <label className="flex items-center gap-3 p-4 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <input type="checkbox" checked={countsForElo} onChange={e => setCountsForElo(e.target.checked)} className="w-5 h-5 accent-primary" />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Count for ELO</div>
                      <div className="text-xs text-slate-500">Team rubbers will update players' personal and category ELO.</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-4 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <input type="checkbox" checked={ignoreGenderRules} onChange={e => setIgnoreGenderRules(e.target.checked)} className="w-5 h-5 accent-primary" />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Ignore Gender Rules</div>
                      <div className="text-xs text-slate-500">Allow any player to play any rubber (e.g. women in MS).</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-4 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <input type="checkbox" checked={playDeadRubbers} onChange={e => setPlayDeadRubbers(e.target.checked)} className="w-5 h-5 accent-primary" />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Play Dead Rubbers</div>
                      <div className="text-xs text-slate-500">Play all remaining rubbers even if the tie is already won.</div>
                    </div>
                  </label>
                </div>
              </PageTransition>
            )}

            {step === 3 && (
              <PageTransition key="step3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h2 className="text-xl font-black">3. {formatFamily === 'OPEN_EVENT' ? 'Import Entrants' : 'Import Teams'}</h2>
                  <button onClick={handleDownloadTemplate} className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:bg-primary/10 px-3 py-2 rounded-lg transition-colors">
                    <Download className="w-4 h-4" /> Download Template
                  </button>
                </div>
                
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-10 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <UploadCloud className="w-16 h-16 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-bold mb-2">Upload CSV</h3>
                  
                  {file ? (
                    <div className="mb-6">
                      <div className="text-[var(--success)] font-black mb-1">{file.name}</div>
                      <div className="text-sm text-slate-500">{parsedTeams} records parsed</div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 mb-6">Drag and drop your file here</p>
                  )}
                  
                  <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl font-black shadow-md hover:scale-105 transition-transform"
                  >
                    {file ? 'Change File' : 'Browse Files'}
                  </button>
                </div>
              </PageTransition>
            )}

            {step === 4 && (
              <PageTransition key="step4">
                <div className="text-center mb-8">
                  <CheckCircle2 className="w-16 h-16 text-[var(--success)] mx-auto mb-4" />
                  <h2 className="text-2xl font-black mb-2">Ready to Go Live</h2>
                  <p className="text-slate-500">Review your tournament settings before publishing.</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-sm text-slate-500 font-bold">Name</span>
                    <span className="font-black text-slate-800 dark:text-slate-200">{name}</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-sm text-slate-500 font-bold">Location</span>
                    <span className="font-black text-slate-800 dark:text-slate-200">{location}</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-sm text-slate-500 font-bold">Type</span>
                    <span className="font-black text-primary">{formatFamily === 'OPEN_EVENT' ? 'Open Event' : 'Team Tie'}</span>
                  </div>
                  {formatFamily === 'TEAM' && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500 font-bold">Format</span>
                      <span className="font-black text-slate-800 dark:text-slate-200">{format === 'standard' ? 'BWF Standard' : 'Custom Format'}</span>
                    </div>
                  )}
                </div>
              </PageTransition>
            )}
          </AnimatePresence>

          <div className="mt-auto pt-8 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/50">
            {step > 1 ? (
              <button 
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" /> Back
              </button>
            ) : <div />}
            
            <button 
              onClick={handleNext}
              disabled={isPublishing || (step === 1 && !isStep1Valid)}
              className="flex items-center gap-2 px-8 py-3 rounded-xl font-black bg-primary text-slate-950 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30"
            >
              {isPublishing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {step === 4 ? 'Publish' : 'Continue'} 
              {step !== 4 && <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
