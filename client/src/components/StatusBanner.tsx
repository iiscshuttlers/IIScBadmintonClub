import { useEffect, useState } from "react";

/* ---------------- TYPES ---------------- */

type Holiday = { date: string; name: string };

type Event = {
  date: string;
  title: string;
  link: string;
  registrationDeadline?: string;
};

type Booking = {
  category: string;
  priority: string;
  location: string;
  slots: {
    date: string;
    startTime: string;
    endTime: string;
  }[];
};

type Alert = {
  message: string;
  type: "critical" | "warning" | "info";
};

/* ---------------- COMPONENT ---------------- */

export default function StatusBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [index, setIndex] = useState(0);

  const today = getToday();
  const tomorrow = getTomorrow();

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/holidays.json`).then(res => res.json()),
      fetch(`${import.meta.env.BASE_URL}data/events.json`).then(res => res.json()),
    ]).then(([holidays, data]) => {
      let alerts: Alert[] = [];

      /* ---------------- HOLIDAYS ---------------- */

      const todayHoliday = holidays.find((h: Holiday) => h.date === today);
      const tomorrowHoliday = holidays.find((h: Holiday) => h.date === tomorrow);

      if (todayHoliday) {
        alerts.push({
          message: `🏸 Courts closed today – ${todayHoliday.name}`,
          type: "critical",
        });
      }

      if (tomorrowHoliday) {
        alerts.push({
          message: `⚠️ Closed tomorrow – ${tomorrowHoliday.name}`,
          type: "warning",
        });
      }

      /* ---------------- BOOKINGS ---------------- */

      const bookings = data.filter(
        (e: Booking) => e.category === "facility" && e.priority === "high"
      );

      bookings.forEach((event: Booking) => {
        const todaySlots = event.slots?.filter(s => s.date === today);

        if (todaySlots?.length) {
          const ranges = todaySlots.map(
            s => `${formatTime(s.startTime)}–${formatTime(s.endTime)}`
          );

          alerts.push({
            message: `🚫 ${event.location} booked today: ${ranges.join(", ")}`,
            type: "critical",
          });
        }

        const tomorrowSlots = event.slots?.filter(s => s.date === tomorrow);

        if (tomorrowSlots?.length) {
          const ranges = tomorrowSlots.map(
            s => `${formatTime(s.startTime)}–${formatTime(s.endTime)}`
          );

          alerts.push({
            message: `⚠️ ${event.location} booked tomorrow: ${ranges.join(", ")}`,
            type: "warning",
          });
        }
      });

      /* ---------------- EVENTS ---------------- */

      data.forEach((e: Event) => {
        const diff = dateDiff(today, e.date);

        if (diff >= 0 && diff <= 7) {
          alerts.push({
            message: `🎉 ${e.title} → Register`,
            type: "info",
          });
        }

        if (e.registrationDeadline === today) {
          alerts.push({
            message: `⚡ Last day to register – ${e.title}`,
            type: "critical",
          });
        }
      });

      setAlerts(alerts);
    });
  }, []);

  /* ---------------- ROTATION ---------------- */

  useEffect(() => {
    if (alerts.length <= 1) return;

    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % alerts.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [alerts]);

  if (!alerts.length) return null;

  const current = alerts[index];

  return (
    <div className={`banner ${getBg(current.type)} whitespace-pre-line`}>
      {current.message}
    </div>
  );
}

/* ---------------- HELPERS ---------------- */

function getBg(type: string) {
  if (type === "critical") return "banner-red";
  if (type === "warning") return "banner-yellow";
  return "banner-green";
}

function getToday() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);

  return d.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
}

function dateDiff(d1: string, d2: string) {
  return (
    (new Date(d2).getTime() - new Date(d1).getTime()) /
    (1000 * 3600 * 24)
  );
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;

  return `${formattedHour}:${m} ${suffix}`;
}