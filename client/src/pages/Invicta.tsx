import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Calendar, MapPin, Users, UserCheck, FileText, Upload, X, Loader2, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '../lib/supabase';
import { isAdminEmail } from '../lib/admin';
import { useSupabaseSession } from '../hooks/useSupabaseSession';

type BracketMatch = { player1: string; player2: string; winner?: string; score?: string };
type BracketRound = { label: string; matches: BracketMatch[] };

function generateEmptyBracket(size: number): BracketRound[] {
  const rounds: BracketRound[] = [];
  let currentSize = size;
  let roundNum = 1;
  
  while (currentSize >= 2) {
    const matchCount = currentSize / 2;
    const matches: BracketMatch[] = Array.from({ length: matchCount }).map(() => ({
      player1: 'TBD',
      player2: 'TBD',
    }));
    
    let label = `Round ${roundNum}`;
    if (currentSize === 8) label = 'Quarterfinals';
    if (currentSize === 4) label = 'Semifinals';
    if (currentSize === 2) label = 'Final';
    
    rounds.push({ label, matches });
    currentSize /= 2;
    roundNum++;
  }
  
  return rounds;
}

export default function Invicta() {
  const { session } = useSupabaseSession();
  const isAdmin = isAdminEmail(session?.user?.email);
  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Failsafe: never leave the spinner running indefinitely
    const failsafe = setTimeout(() => {
      if (mountedRef.current) setLoadingFiles(false);
    }, 10_000);

    fetchNotices().finally(() => clearTimeout(failsafe));

    return () => { mountedRef.current = false; clearTimeout(failsafe); };
  }, []);

  const fetchNotices = async () => {
    if (!mountedRef.current) return;
    setLoadingFiles(true);
    try {
      const { data, error } = await supabase.storage.from('invicta_notices').list('');
      if (!mountedRef.current) return;
      if (error) {
        console.error("Bucket might not exist yet:", error.message);
        setFiles([]);
      } else {
        setFiles(data?.filter(f => !f.name.startsWith('.')) || []);
      }
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setFiles([]);
    } finally {
      if (mountedRef.current) setLoadingFiles(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error } = await supabase.storage.from('invicta_notices').upload(fileName, file, { upsert: true });
      if (error) throw error;
      await fetchNotices();
    } catch (err: any) {
      setUploadError("Upload failed: " + (err.message ?? "Unknown error"));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!confirm("Are you sure you want to delete this notice?")) return;
    try {
      const { error } = await supabase.storage.from('invicta_notices').remove([fileName]);
      if (error) throw error;
      await fetchNotices();
    } catch (err: any) {
      setUploadError("Delete failed: " + (err.message ?? "Unknown error"));
    }
  };

  return (
    <div className="py-12 bg-slate-50 dark:bg-slate-900 min-h-[calc(100vh-80px)]">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-blue-900 p-12 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            <Trophy className="w-20 h-20 mx-auto mb-6 text-emerald-300 relative z-10" />
            <h1 className="text-4xl md:text-6xl font-extrabold mb-4 tracking-tight relative z-10">
              INVICTA 2026
            </h1>
            <p className="text-emerald-100 text-xl md:text-2xl font-medium max-w-2xl mx-auto relative z-10">
              The Ultimate IISc Badminton Showdown
            </p>
          </div>

          {/* Content */}
          <div className="p-8 md:p-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl flex flex-col items-center text-center border border-slate-100 dark:border-slate-700">
                <Calendar className="w-8 h-8 text-emerald-500 mb-3" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">Dates</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs">1st June - 21st June</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl flex flex-col items-center text-center border border-slate-100 dark:border-slate-700">
                <MapPin className="w-8 h-8 text-emerald-500 mb-3" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">Venue</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs">Gymkhana Courts</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl flex flex-col items-center text-center border border-slate-100 dark:border-slate-700">
                <Users className="w-8 h-8 text-emerald-500 mb-3" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">Categories</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs">MS, WS, MD, WD, XD</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl flex flex-col items-center text-center border border-slate-100 dark:border-slate-700">
                <UserCheck className="w-8 h-8 text-emerald-500 mb-3" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">Eligibility</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs">All IISc Members</p>
              </div>
            </div>

            <div className="text-center bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-700 dark:text-slate-300 mb-4">
                Registrations are now closed
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg">
                The registration deadline (26 May 2026) has passed. Stay tuned for tournament updates.
              </p>
            </div>

            {/* Notices & Announcements Section */}
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <FileText className="text-emerald-500" />
                  Official Notices & Announcements
                </h3>
                
                {isAdmin && (
                  <label className="cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors border border-emerald-200">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Uploading...' : 'Upload Notice'}
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,image/*" disabled={uploading} />
                  </label>
                )}
              </div>

              {/* Inline error banner — replaces alert() */}
              {uploadError && (
                <div className="mb-4 flex items-start gap-2 px-4 py-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-400 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                  <button onClick={() => setUploadError(null)} className="ml-auto text-rose-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
                </div>
              )}

              {loadingFiles ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-500 text-sm">
                  No official notices have been uploaded yet. Check back later!
                </div>
              ) : (
                <div className="grid gap-3">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-200 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="truncate">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{file.name.replace(/^\d+_/, '')}</p>
                          <p className="text-xs text-slate-500">{(file.metadata?.size / 1024).toFixed(1)} KB • Uploaded {(new Date(file.created_at)).toLocaleDateString()}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a 
                          href={supabase.storage.from('invicta_notices').getPublicUrl(file.name).data.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Download / View"
                        >
                          <Download className="w-5 h-5" />
                        </a>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteFile(file.name)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete File"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="mt-12 text-center text-slate-500 dark:text-slate-400">
              <p>More details regarding fixtures, rules, and brackets will be updated here soon.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
