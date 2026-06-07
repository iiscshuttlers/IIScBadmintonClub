const fs = require('fs');
const path = require('path');

function addDarkMode(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  if (filePath.includes('LiveTournament.tsx')) {
    content = content.replace(/bg-gradient-to-br from-slate-50 to-emerald-50/g, 'bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900');
    content = content.replace(/bg-white/g, 'bg-white dark:bg-slate-900');
    content = content.replace(/text-gray-800/g, 'text-gray-800 dark:text-slate-100');
    content = content.replace(/text-gray-700/g, 'text-gray-700 dark:text-slate-300');
    content = content.replace(/text-gray-600/g, 'text-gray-600 dark:text-slate-400');
    content = content.replace(/text-gray-500/g, 'text-gray-500 dark:text-slate-500');
    content = content.replace(/text-gray-400/g, 'text-gray-400 dark:text-slate-500');
    content = content.replace(/bg-gray-100/g, 'bg-gray-100 dark:bg-slate-800');
    content = content.replace(/bg-gray-50/g, 'bg-gray-50 dark:bg-slate-800/50');
    content = content.replace(/border-gray-100/g, 'border-gray-100 dark:border-slate-800');
    content = content.replace(/border-gray-200/g, 'border-gray-200 dark:border-slate-700');
    content = content.replace(/border-gray-300/g, 'border-gray-300 dark:border-slate-600');
    content = content.replace(/text-emerald-700/g, 'text-emerald-700 dark:text-emerald-400');
    content = content.replace(/text-emerald-900/g, 'text-emerald-900 dark:text-emerald-300');
    content = content.replace(/text-red-900/g, 'text-red-900 dark:text-red-300');
    content = content.replace(/bg-red-50(\/50)?/g, 'bg-red-50$1 dark:bg-red-950/20');
    content = content.replace(/bg-red-100/g, 'bg-red-100 dark:bg-red-900/30');
    content = content.replace(/border-red-500/g, 'border-red-500 dark:border-red-900');
    content = content.replace(/border-red-200/g, 'border-red-200 dark:border-red-900/50');
    content = content.replace(/bg-emerald-50/g, 'bg-emerald-50 dark:bg-emerald-950/20');
    content = content.replace(/border-emerald-200/g, 'border-emerald-200 dark:border-emerald-900/50');
  } else if (filePath.includes('ScheduleView.tsx')) {
    content = content.replace(/text-slate-900/g, 'text-slate-900 dark:text-white');
    content = content.replace(/text-slate-700/g, 'text-slate-700 dark:text-slate-200');
    content = content.replace(/text-slate-600/g, 'text-slate-600 dark:text-slate-300');
    content = content.replace(/text-slate-500/g, 'text-slate-500 dark:text-slate-400');
    content = content.replace(/text-slate-400/g, 'text-slate-400 dark:text-slate-500');
    content = content.replace(/text-slate-300/g, 'text-slate-300 dark:text-slate-600');
    content = content.replace(/text-slate-200/g, 'text-slate-200 dark:text-slate-700');
    
    content = content.replace(/bg-white/g, 'bg-white dark:bg-slate-900');
    content = content.replace(/bg-slate-50/g, 'bg-slate-50 dark:bg-slate-800');
    content = content.replace(/bg-slate-100/g, 'bg-slate-100 dark:bg-slate-800');
    content = content.replace(/bg-slate-200/g, 'bg-slate-200 dark:bg-slate-700');
    content = content.replace(/bg-slate-300/g, 'bg-slate-300 dark:bg-slate-600');

    content = content.replace(/border-slate-100/g, 'border-slate-100 dark:border-slate-800');
    content = content.replace(/border-slate-200/g, 'border-slate-200 dark:border-slate-700');
    
    content = content.replace(/from-white to-white/g, 'from-white to-white dark:from-slate-900 dark:to-slate-900');
    content = content.replace(/from-slate-50/g, 'from-slate-50 dark:from-slate-900');
    content = content.replace(/to-slate-50/g, 'to-slate-50 dark:to-slate-900');
    content = content.replace(/from-slate-200/g, 'from-slate-200 dark:from-slate-800');
    content = content.replace(/via-slate-200/g, 'via-slate-200 dark:via-slate-800');
    
    content = content.replace(/bg-amber-100/g, 'bg-amber-100 dark:bg-amber-900/40');
    content = content.replace(/text-amber-700/g, 'text-amber-700 dark:text-amber-400');
    content = content.replace(/ring-amber-200/g, 'ring-amber-200 dark:ring-amber-900/50');
    
    // Format colors
    content = content.replace(/bg-blue-50(?!0)/g, 'bg-blue-50 dark:bg-blue-900/30');
    content = content.replace(/bg-pink-50(?!0)/g, 'bg-pink-50 dark:bg-pink-900/30');
    content = content.replace(/bg-emerald-50(?!0)/g, 'bg-emerald-50 dark:bg-emerald-900/30');
    content = content.replace(/bg-purple-50(?!0)/g, 'bg-purple-50 dark:bg-purple-900/30');
    content = content.replace(/bg-orange-50(?!0)/g, 'bg-orange-50 dark:bg-orange-900/30');
    
    content = content.replace(/text-blue-700/g, 'text-blue-700 dark:text-blue-400');
    content = content.replace(/text-pink-700/g, 'text-pink-700 dark:text-pink-400');
    // text-emerald-700 already handled above or generally
    content = content.replace(/text-purple-700/g, 'text-purple-700 dark:text-purple-400');
    content = content.replace(/text-orange-700/g, 'text-orange-700 dark:text-orange-400');
    
    content = content.replace(/border-blue-100/g, 'border-blue-100 dark:border-blue-900/50');
    content = content.replace(/border-pink-100/g, 'border-pink-100 dark:border-pink-900/50');
    content = content.replace(/border-emerald-100/g, 'border-emerald-100 dark:border-emerald-900/50');
    content = content.replace(/border-purple-100/g, 'border-purple-100 dark:border-purple-900/50');
    content = content.replace(/border-orange-100/g, 'border-orange-100 dark:border-orange-900/50');
    
    // Pool colors
    content = content.replace(/from-amber-50 to-yellow-50/g, 'from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30');
    content = content.replace(/from-blue-50 to-indigo-50/g, 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30');
    content = content.replace(/from-emerald-50 to-teal-50/g, 'from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30');
    content = content.replace(/from-rose-50 to-red-50/g, 'from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30');
    content = content.replace(/border-amber-200/g, 'border-amber-200 dark:border-amber-900/50');
    content = content.replace(/border-blue-100/g, 'border-blue-100 dark:border-blue-900/50');
    content = content.replace(/border-emerald-100/g, 'border-emerald-100 dark:border-emerald-900/50');
    content = content.replace(/border-rose-100/g, 'border-rose-100 dark:border-rose-900/50');

  }

  fs.writeFileSync(filePath, content);
}

addDarkMode(path.join(__dirname, '../client/src/pages/LiveTournament.tsx'));
addDarkMode(path.join(__dirname, '../client/src/pages/ScheduleView.tsx'));
console.log("Dark mode classes added");
