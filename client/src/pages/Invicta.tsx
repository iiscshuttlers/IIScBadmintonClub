import { motion } from 'framer-motion';
import { ExternalLink, Trophy, Calendar, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Invicta() {
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
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl flex flex-col items-center text-center border border-slate-100 dark:border-slate-700">
                <Calendar className="w-10 h-10 text-emerald-500 mb-4" />
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-1">Dates</h3>
                <p className="text-slate-600 dark:text-slate-400">1st June - 21st June (Tentative)</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl flex flex-col items-center text-center border border-slate-100 dark:border-slate-700">
                <MapPin className="w-10 h-10 text-emerald-500 mb-4" />
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-1">Venue</h3>
                <p className="text-slate-600 dark:text-slate-400">Gymkhana Badminton Courts</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl flex flex-col items-center text-center border border-slate-100 dark:border-slate-700">
                <Users className="w-10 h-10 text-emerald-500 mb-4" />
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-1">Categories</h3>
                <p className="text-slate-600 dark:text-slate-400">MS, WS, MD, WD, XD</p>
              </div>
            </div>

            <div className="text-center bg-emerald-50 dark:bg-emerald-950/30 p-8 rounded-3xl border border-emerald-100 dark:border-emerald-900/50">
              <h2 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-emerald-400 mb-4">
                Registrations opening soon!
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-8 max-w-2xl mx-auto text-lg">
                The official Microsoft Form for registration will be available here soon. Note: The form will be restricted to IISc members.
              </p>
              
              <Button disabled className="bg-slate-300 dark:bg-slate-800 text-slate-500 font-bold text-lg px-8 py-6 rounded-full cursor-not-allowed gap-3">
                <span>Registration Link Coming Soon</span>
              </Button>
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
