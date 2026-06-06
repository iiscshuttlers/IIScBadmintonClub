import { ReactNode } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';

type Tab = {
  href: string;
  label: string;
};

interface HubLayoutProps {
  title: string;
  tabs: Tab[];
  activeHref: string;
  children: ReactNode;
}

export default function HubLayout({ title, tabs, activeHref, children }: HubLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Sub-navigation Tab Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-[59px] z-40 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="hidden md:block font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-sm mr-8">
              {title}
            </div>
            <div className="flex overflow-x-auto no-scrollbar gap-6 flex-1">
              {tabs.map((tab) => {
                const isActive = activeHref === tab.href;
                return (
                  <Link key={tab.href} href={tab.href}>
                    <button
                      className={`relative whitespace-nowrap py-4 px-1 text-sm font-bold transition-colors ${
                        isActive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                      {isActive && (
                        <motion.div
                          layoutId={`hub-tab-indicator-${title}`}
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full"
                          initial={false}
                        />
                      )}
                    </button>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
