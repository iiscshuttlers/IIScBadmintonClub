import { useEffect, useState } from "react";

type Holiday = { date: string; name: string };
type Event = {
  date: string;
  title: string;
  link: string;
  registrationDeadline?: string;
};

export default function StatusBanner() {
  const [messages, setMessages] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [bg, setBg] = useState("bg-green-600");

  const todayDate = new Date();

  const today = todayDate.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  const tomorrow = tomorrowDate.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/holidays.json`).then(res => res.json()),
      fetch(`${import.meta.env.BASE_URL}data/events.json`).then(res => res.json()),
    ]).then(([holidays, events]) => {
      let msgs: string[] = [];

      const todayHoliday = holidays.find((h: Holiday) => h.date === today);
      const tomorrowHoliday = holidays.find((h: Holiday) => h.date === tomorrow);

      // 🔴 Today closed
      if (todayHoliday) {
        msgs.push(`🏸 Courts closed today – ${todayHoliday.name}`);
        setBg("bg-red-600");
      }

      // 🟡 Tomorrow closed
      if (tomorrowHoliday) {
        msgs.push(`⚠️ Courts closed tomorrow – ${tomorrowHoliday.name}`);
        if (!todayHoliday) setBg("bg-yellow-500");
      }

      // 📅 Upcoming closures (next 2 days, excluding today & tomorrow)
      holidays.forEach((h: Holiday) => {
        if (h.date !== today && h.date !== tomorrow) {
          const diff =
            (new Date(h.date).getTime() - new Date(today).getTime()) /
            (1000 * 3600 * 24);

          if (diff > 1 && diff <= 2) {
            const readable = new Date(h.date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            });

            msgs.push(`📅 Courts closed on ${readable} – ${h.name}`);
          }
        }
      });

      // 🔵 Events
      events.forEach((e: Event) => {
        const diff =
          (new Date(e.date).getTime() - new Date(today).getTime()) /
          (1000 * 3600 * 24);

        if (diff >= 0 && diff <= 7) {
          msgs.push(`🎉 ${e.title} → Register`);
        }

        if (e.registrationDeadline === today) {
          msgs.push(`⚡ Last day to register – ${e.title}`);
        }
      });

      setMessages(msgs);
    });
  }, []);

  // 🔁 Rotation
  useEffect(() => {
    if (messages.length <= 1) return;

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [messages]);

  if (!messages.length) return null;

  return (
    <div className={`${bg} text-white text-center py-2 text-sm font-semibold transition-all`}>
      {messages[index]}
    </div>
  );
}
