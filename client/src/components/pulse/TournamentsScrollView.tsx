import React from "react";
import { Trophy } from "lucide-react";

export interface TournamentsScrollViewProps {
  liveEvents?: any[];
  upcomingEvents?: any[];
  completedEvents?: any[];
  renderCard?: (item: any, liveMode?: boolean) => React.ReactNode;
}

export function TournamentsScrollView({ 
  liveEvents = [], 
  upcomingEvents = [], 
  completedEvents = [], 
  renderCard 
}: TournamentsScrollViewProps) {
  
  return (
    <div className="space-y-12 pb-16 font-sans">
      
      {liveEvents.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-8 bg-gradient-to-b from-rose-500 to-red-600 rounded-full animate-pulse" />
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">
              Live Now
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {liveEvents.map((event, idx) => (
               <React.Fragment key={event.id || idx}>
                 {renderCard ? renderCard(event, true) : null}
               </React.Fragment>
             ))}
          </div>
        </section>
      )}

      {upcomingEvents.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-8 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full" />
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">
              Upcoming Events
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {upcomingEvents.map((event, idx) => (
               <React.Fragment key={event.id || idx}>
                 {renderCard ? renderCard(event, false) : null}
               </React.Fragment>
             ))}
          </div>
        </section>
      )}

      {completedEvents.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-8 bg-gradient-to-b from-slate-400 to-slate-500 rounded-full" />
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">
              Past Events
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {completedEvents.map((event, idx) => (
               <React.Fragment key={event.id || idx}>
                 {renderCard ? renderCard(event, false) : null}
               </React.Fragment>
             ))}
          </div>
        </section>
      )}
      
      {liveEvents.length === 0 && upcomingEvents.length === 0 && completedEvents.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="w-20 h-20 mx-auto bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">No Tournaments</h3>
          <p className="text-slate-500 max-w-sm mx-auto">There are no tournaments matching the criteria.</p>
        </div>
      )}
    </div>
  );
}
