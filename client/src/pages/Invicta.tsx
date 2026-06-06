import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Calendar, MapPin, Users, UserCheck, FileText, Upload, X, Loader2, Download, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isAdminEmail } from '../lib/admin';
import { useAuth } from '../contexts/AuthContext';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.45, delay: i * 0.08, ease: 'easeOut' as const } }),
};

export default function Invicta() {
  const { session } = useAuth();
  const isAdmin = isAdminEmail(session?.user?.email);
  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
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

  const infoCards = [
    { icon: Calendar,  label: 'Dates',        value: '1st – 21st June',   color: 'bg-emerald-500' },
    { icon: MapPin,    label: 'Venue',         value: 'Gymkhana Courts',    color: 'bg-blue-600' },
    { icon: Users,     label: 'Categories',    value: 'MS · WS · MD · WD · XD', color: 'bg-purple-600' },
    { icon: UserCheck, label: 'Eligibility',   value: 'All IISc Members',   color: 'bg-orange-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-emerald-950 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern" />
        {/* Decorative glow */}
        <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex p-5 rounded-full bg-white/10 border border-white/20 mb-6"
          >
            <Trophy className="w-14 h-14 text-amber-400" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <div className="inline-flex items-center gap-2 bg-amber-400/20 border border-amber-400/30 text-amber-300 px-4 py-2 rounded-full text-sm font-bold mb-5">
              🏸 Open Tournament
            </div>
            <h1
              className="text-5xl md:text-7xl font-black mb-4 tracking-tight"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              INVICTA 2026
            </h1>
            <p className="text-emerald-200 text-xl md:text-2xl font-medium max-w-2xl mx-auto">
              The Ultimate IISc Badminton Showdown
            </p>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-5xl py-12 space-y-8">

        {/* Info cards */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {infoCards.map(({ icon: Icon, label, value, color }, i) => (
            <motion.div
              key={label}
              custom={i}
              variants={fadeUp}
              className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center gap-3 hover:shadow-md transition-shadow"
            >
              <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center shadow-md`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-bold text-blue-900 dark:text-white mt-0.5">{value}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Registrations closed banner */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 rounded-3xl p-8 text-white text-center relative overflow-hidden border border-slate-700"
        >
          <div className="absolute inset-0 hero-pattern opacity-40" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-2 rounded-full text-sm font-bold mb-4">
              <Clock className="w-4 h-4" />
              Registration Closed
            </div>
            <h2 className="text-2xl md:text-3xl font-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Registrations are now closed
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              The registration deadline (26 May 2026) has passed. Stay tuned for fixtures and match updates below.
            </p>
          </div>
        </motion.div>

        {/* Notices & Announcements */}
        <motion.div
          custom={5}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="bg-white dark:bg-slate-800 rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden"
        >
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-blue-600" />
          <div className="p-7 md:p-9">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/30 rounded-xl">
                  <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                Official Notices
              </h3>

              {isAdmin && (
                <label className="cursor-pointer inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors border border-emerald-200 dark:border-emerald-800">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Uploading…' : 'Upload Notice'}
                  <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,image/*" disabled={uploading} />
                </label>
              )}
            </div>

            {uploadError && (
              <div className="mb-5 flex items-start gap-2 px-4 py-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-400 text-sm font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
                <button onClick={() => setUploadError(null)} className="ml-auto text-rose-400 hover:text-rose-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {loadingFiles ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-14 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-semibold">No notices yet</p>
                <p className="text-slate-400 dark:text-slate-600 text-sm mt-1">Check back soon for fixtures and updates.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="truncate min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate text-sm">{file.name.replace(/^\d+_/, '')}</p>
                        <p className="text-xs text-slate-400">
                          {(file.metadata?.size / 1024).toFixed(1)} KB · {new Date(file.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                      <a
                        href={supabase.storage.from('invicta_notices').getPublicUrl(file.name).data.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-colors"
                        title="Download / View"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteFile(file.name)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                          title="Delete"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        <p className="text-center text-slate-500 dark:text-slate-400 text-sm pb-4">
          More details regarding fixtures, rules, and schedules will be updated here.
        </p>
      </div>
    </div>
  );
}
