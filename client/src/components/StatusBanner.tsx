// client/src/components/StatusBanner.tsx

import { useEffect, useState } from 'react';

export default function StatusBanner() {
  const [holiday, setHoliday] = useState<any>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/holidays.json`)
      .then((res) => res.json())
      .then((data) => {
        const today = new Date().toLocaleDateString('en-CA', {
          timeZone: 'Asia/Kolkata',
        });

        const todayHoliday = data.find((h: any) => h.date === today);

        if (todayHoliday) {
          setHoliday(todayHoliday);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  if (!holiday) return null;

  return (
    <div className="bg-red-600 text-white text-center py-3 text-sm font-semibold animate-pulse">
      🏸 Courts closed today – {holiday.name}
    </div>
  );
}
