import { useState, useEffect, useMemo, useRef } from "react";
import {
  CalendarDays,
  ShieldCheck,
  CalendarX,
  X,
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  Building2,
  AlertCircle,
  History,
  ChevronDown,
  ChevronUp,
  Search,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  Trophy
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchSiteData } from "@/lib/siteData";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Holiday = {
  date: string;
  name: string;
};

export interface CourtReservation {
  id: string;
  tournament_name: string;
  department?: string;
  date: string; // YYYY-MM-DD
  courts: string[]; // ["1", "2", "3"]
  start_time: string; // "09:00"
  end_time: string; // "13:00"
  created_at?: string;
}

interface ScheduledMatch {
  id: string;
  tournament_id: string;
  match_code: string;
  category: string;
  court_number: string | null;
  scheduled_at: string | null;
  status: string;
  team1_label: string | null;
  team2_label: string | null;
  tournament_name?: string;
}

export interface BookingDisplayItem {
  id: string;
  title: string;
  subtitle?: string;
  department?: string;
  courts?: string[];
  date?: string;
  startTimeStr: string;
  endTimeStr: string;
  leftPercent: number;
  widthPercent: number;
  isManual?: boolean;
}

// Operating Hours: 6:00 AM to 10:20 PM
const DAY_START_MINUTES = 6 * 60; // 360 mins (6:00 AM)
const DAY_END_MINUTES = 22 * 60 + 20; // 1340 mins (10:20 PM)
const TOTAL_MINUTES = DAY_END_MINUTES - DAY_START_MINUTES; // 980 mins

// Convert "09:00" to "9 AM", "13:00" to "1 PM", "19:00" to "7 PM", "22:20" to "10:20 PM"
function formatTime12h(timeStr: string): string {
  if (!timeStr) return "";
  if (timeStr.toLowerCase().includes("am") || timeStr.toLowerCase().includes("pm")) {
    return timeStr;
  }
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const formattedH = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${formattedH} ${ampm}` : `${formattedH}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function CourtScheduleSection() {
  const { isAdmin, isMasterAdmin } = useAuth();
  const isAuthorizedAdmin = isAdmin || isMasterAdmin;

  // Today's date in IST (Asia/Kolkata)
  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [selectedCourtDetails, setSelectedCourtDetails] = useState<number | null>(null);
  const [showAdminBookingModal, setShowAdminBookingModal] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<"upcoming" | "past" | "all">("upcoming");
  const [historySearch, setHistorySearch] = useState("");
  const [deleteConfirmBooking, setDeleteConfirmBooking] = useState<{
    id: string;
    title: string;
    date: string;
    courts: string[];
  } | null>(null);

  // Timeline view modal state
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<"all" | "tournaments" | "holidays">("all");

  // Refs for horizontal date strip scrolling
  const dateStripRef = useRef<HTMLDivElement>(null);
  const modalDateStripRef = useRef<HTMLDivElement>(null);

  // Admin booking form state
  const [bookingTournament, setBookingTournament] = useState("");
  const [bookingDepartment, setBookingDepartment] = useState("");
  const [bookingDates, setBookingDates] = useState<string[]>([todayStr]);
  const [newDateInput, setNewDateInput] = useState<string>(todayStr);
  const [dateRangeStart, setDateRangeStart] = useState<string>(todayStr);
  const [dateRangeEnd, setDateRangeEnd] = useState<string>(todayStr);
  const [dateSelectionMode, setDateSelectionMode] = useState<"individual" | "range">("individual");
  const [bookingCourts, setBookingCourts] = useState<string[]>(["1"]);
  const [bookingSlot, setBookingSlot] = useState<string>("09:00-13:00");
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("13:00");
  const [isSavingBooking, setIsSavingBooking] = useState(false);

  // Helper to compute consecutive dates from start to end
  const applyDateRange = (start: string, end: string) => {
    if (!start || !end) return;
    const dStart = new Date(start);
    const dEnd = new Date(end);
    if (dStart > dEnd) return;
    const days: string[] = [];
    const current = new Date(dStart);
    let count = 0;
    while (current <= dEnd && count < 30) {
      days.push(current.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
      current.setDate(current.getDate() + 1);
      count++;
    }
    if (days.length > 0) {
      setBookingDates(days);
    }
  };

  // Matches from tournament_matches
  const [matches, setMatches] = useState<ScheduledMatch[]>([]);

  // Custom Reservations from site_data
  const [reservations, setReservations] = useState<CourtReservation[]>([]);

  // Fetch Gymkhana Holidays
  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ["holidays"],
    queryFn: () => fetchSiteData<Holiday[]>("holidays", "holidays.json"),
    staleTime: 300_000,
  });

  const currentHoliday = useMemo(() => {
    return holidays.find((h) => h.date === selectedDate) || null;
  }, [holidays, selectedDate]);

  // Scrollable date strip spanning past 30 days to next 120 days (infinite left & right navigation)
  const quickDays = useMemo(() => {
    const list = [];
    const baseDate = new Date();
    for (let i = -30; i <= 120; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const isoDate = d.toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });
      const dayName =
        i === 0
          ? "Today"
          : i === 1
          ? "Tomorrow"
          : i === -1
          ? "Yesterday"
          : d.toLocaleDateString("en-IN", { weekday: "short" });
      const formattedDate = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
      const holiday = holidays.find((h) => h.date === isoDate);

      // Check if any reservation or match is booked on this date
      const resCount = reservations.filter((r) => r.date === isoDate).length;
      const matchCount = matches.filter((m) => {
        if (!m.scheduled_at) return false;
        const matchDate = new Date(m.scheduled_at).toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata",
        });
        return matchDate === isoDate;
      }).length;
      const totalBookings = resCount + matchCount;

      list.push({
        dateStr: isoDate,
        dayName,
        formattedDate,
        isHoliday: !!holiday,
        holidayName: holiday?.name,
        bookingCount: totalBookings,
        isToday: i === 0,
      });
    }
    return list;
  }, [holidays, reservations, matches]);

  const scrollToDate = (dateStr: string, smooth = true) => {
    if (!dateStripRef.current) return;
    const container = dateStripRef.current;
    const targetEl = container.querySelector(`[data-date="${dateStr}"]`) as HTMLElement | null;
    if (targetEl) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const targetCenter = targetRect.left + targetRect.width / 2;
      const containerCenter = containerRect.left + containerRect.width / 2;
      const offsetDiff = targetCenter - containerCenter;

      container.scrollTo({
        left: container.scrollLeft + offsetDiff,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  const handleJumpToToday = () => {
    setSelectedDate(todayStr);
    scrollToDate(todayStr, true);
  };

  const scrollDateStrip = (direction: "left" | "right", isModal = false) => {
    const ref = isModal ? modalDateStripRef.current : dateStripRef.current;
    if (ref) {
      const amount = direction === "left" ? -300 : 300;
      ref.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  // Center selected date into view whenever selectedDate changes
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToDate(selectedDate, true);
    }, 30);
    return () => clearTimeout(timer);
  }, [selectedDate]);

  // Combined Chronological Timeline Groups (Month-by-Month) for Timeline Modal
  const timelineGroups = useMemo(() => {
    interface TimelineEventItem {
      id: string;
      type: "booking" | "holiday";
      date: string;
      title: string;
      subtitle?: string;
      department?: string;
      courts?: string[];
      startTime?: string;
      endTime?: string;
      monthKey: string;
      monthLabel: string;
    }

    const items: TimelineEventItem[] = [];

    reservations.forEach((r) => {
      const d = new Date(r.date + "T12:00:00");
      const monthKey = r.date.substring(0, 7);
      const monthLabel = d.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });
      items.push({
        id: `res-${r.id}`,
        type: "booking",
        date: r.date,
        title: r.tournament_name,
        department: r.department,
        courts: r.courts,
        startTime: r.start_time,
        endTime: r.end_time,
        monthKey,
        monthLabel,
      });
    });

    holidays.forEach((h) => {
      const d = new Date(h.date + "T12:00:00");
      const monthKey = h.date.substring(0, 7);
      const monthLabel = d.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });
      items.push({
        id: `hol-${h.date}-${h.name}`,
        type: "holiday",
        date: h.date,
        title: h.name,
        subtitle: "Gymkhana Facility Closed All Day",
        monthKey,
        monthLabel,
      });
    });

    // Reverse chronological order: newest / latest first
    items.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return (b.startTime || "").localeCompare(a.startTime || "");
    });

    const filtered = items.filter((item) => {
      if (timelineFilter === "tournaments" && item.type !== "booking") return false;
      if (timelineFilter === "holidays" && item.type !== "holiday") return false;
      return true;
    });

    const groups: {
      monthKey: string;
      monthLabel: string;
      items: TimelineEventItem[];
      bookingCount: number;
      holidayCount: number;
    }[] = [];

    const groupMap = new Map<string, {
      monthKey: string;
      monthLabel: string;
      items: TimelineEventItem[];
      bookingCount: number;
      holidayCount: number;
    }>();

    filtered.forEach((item) => {
      if (!groupMap.has(item.monthKey)) {
        const newGroup = {
          monthKey: item.monthKey,
          monthLabel: item.monthLabel,
          items: [],
          bookingCount: 0,
          holidayCount: 0,
        };
        groupMap.set(item.monthKey, newGroup);
        groups.push(newGroup);
      }
      const g = groupMap.get(item.monthKey)!;
      g.items.push(item);
      if (item.type === "booking") g.bookingCount++;
      else g.holidayCount++;
    });

    return groups;
  }, [reservations, holidays, timelineFilter]);

  // Fetch reservations from site_data
  const fetchReservations = async () => {
    try {
      const { data } = await supabase
        .from("site_data")
        .select("value")
        .eq("key", "court_reservations")
        .maybeSingle();

      if (data?.value && Array.isArray(data.value)) {
        setReservations(data.value as unknown as CourtReservation[]);
      } else {
        setReservations([]);
      }
    } catch (err) {
      console.error("Failed to fetch reservations:", err);
    }
  };

  useEffect(() => {
    fetchReservations();

    const channel = supabase
      .channel("court-reservations-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_data",
          filter: "key=eq.court_reservations",
        },
        () => {
          fetchReservations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch matches scheduled for the selected date
  useEffect(() => {
    let isCancelled = false;

    const fetchMatches = async () => {
      try {
        const startOfDay = `${selectedDate}T00:00:00.000Z`;
        const endOfDay = `${selectedDate}T23:59:59.999Z`;

        const { data: matchData } = await supabase
          .from("tournament_matches")
          .select(`
            id,
            tournament_id,
            match_code,
            category,
            court_number,
            scheduled_at,
            status,
            team1_label,
            team2_label,
            tournaments (
              id,
              name,
              tournament_type
            )
          `)
          .gte("scheduled_at", startOfDay)
          .lte("scheduled_at", endOfDay)
          .not("court_number", "is", null);

        if (!isCancelled && matchData) {
          const formatted: ScheduledMatch[] = matchData.map((m: any) => ({
            id: m.id,
            tournament_id: m.tournament_id,
            match_code: m.match_code,
            category: m.category,
            court_number: String(m.court_number || "").replace(/[^0-9]/g, ""),
            scheduled_at: m.scheduled_at,
            status: m.status,
            team1_label: m.team1_label,
            team2_label: m.team2_label,
            tournament_name: m.tournaments?.name || "Tournament",
          }));
          setMatches(formatted);
        }
      } catch (err) {
        console.error("Failed to load court matches:", err);
      }
    };

    fetchMatches();
  }, [selectedDate]);

  // Helper to parse "HH:mm" into minutes from 6:00 AM
  const timeStrToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Compute all booked segments for a court on the selected date
  const getCourtBookings = (courtNum: number): BookingDisplayItem[] => {
    const list: BookingDisplayItem[] = [];

    // 1. Matches from tournament_matches
    matches
      .filter((m) => m.court_number === String(courtNum) && m.scheduled_at)
      .forEach((m) => {
        const d = new Date(m.scheduled_at!);
        const startMin = d.getHours() * 60 + d.getMinutes();
        const clampedStart = Math.max(DAY_START_MINUTES, Math.min(DAY_END_MINUTES, startMin));
        const endMin = Math.min(DAY_END_MINUTES, clampedStart + 45);

        const offset = clampedStart - DAY_START_MINUTES;
        const duration = Math.max(30, endMin - clampedStart);

        const leftPercent = (offset / TOTAL_MINUTES) * 100;
        const widthPercent = (duration / TOTAL_MINUTES) * 100;

        const startStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
        const endD = new Date(d.getTime() + 45 * 60000);
        const endStr = endD.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

        list.push({
          id: m.id,
          title: m.tournament_name || "Tournament Match",
          subtitle: m.category || m.match_code,
          courts: [String(courtNum)],
          startTimeStr: startStr,
          endTimeStr: endStr,
          leftPercent,
          widthPercent: Math.min(widthPercent, 100 - leftPercent),
          isManual: false,
        });
      });

    // 2. Reservations from site_data
    reservations
      .filter((r) => r.date === selectedDate && r.courts.includes(String(courtNum)))
      .forEach((r) => {
        const startMin = timeStrToMinutes(r.start_time);
        const endMin = timeStrToMinutes(r.end_time);

        const clampedStart = Math.max(DAY_START_MINUTES, Math.min(DAY_END_MINUTES, startMin));
        const clampedEnd = Math.max(clampedStart + 15, Math.min(DAY_END_MINUTES, endMin));

        const offset = clampedStart - DAY_START_MINUTES;
        const duration = clampedEnd - clampedStart;

        const leftPercent = (offset / TOTAL_MINUTES) * 100;
        const widthPercent = (duration / TOTAL_MINUTES) * 100;

        list.push({
          id: r.id,
          title: r.tournament_name,
          subtitle: r.department ? `${r.department} Department` : undefined,
          department: r.department,
          courts: r.courts,
          date: r.date,
          startTimeStr: r.start_time,
          endTimeStr: r.end_time,
          leftPercent,
          widthPercent: Math.min(widthPercent, 100 - leftPercent),
          isManual: true,
        });
      });

    return list;
  };

  // Helper to get formatted status text for a specific court
  const getCourtStatusInfo = (courtNum: number) => {
    if (currentHoliday) {
      return {
        isHoliday: true,
        isBooked: false,
        summary: `Facility is closed for ${currentHoliday.name}.`,
        detail: "No matches or play permitted today.",
      };
    }

    const bookings = getCourtBookings(courtNum);
    if (bookings.length === 0) {
      return {
        isHoliday: false,
        isBooked: false,
        summary: "Court is open to play for users",
        detail: "Available full day from 6:00 AM to 10:20 PM.",
      };
    }

    // Build natural sentence: e.g. "C1 is booked from 9:30 AM to 7:00 PM for Faculty Club"
    const timeSpans = bookings.map(
      (b) => `${formatTime12h(b.startTimeStr)} to ${formatTime12h(b.endTimeStr)}`
    );
    const timesJoined =
      timeSpans.length === 1
        ? timeSpans[0]
        : timeSpans.slice(0, -1).join(", ") + " and " + timeSpans[timeSpans.length - 1];

    const depts = Array.from(new Set(bookings.map((b) => b.department).filter(Boolean)));
    const tournaments = Array.from(new Set(bookings.map((b) => b.title)));

    let who = "";
    if (depts.length === 1) {
      who = `for ${depts[0]} department`;
    } else if (tournaments.length === 1) {
      who = `for ${tournaments[0]}`;
    } else {
      who = `for scheduled department events`;
    }

    return {
      isHoliday: false,
      isBooked: true,
      summary: `Court C${courtNum} is booked from ${timesJoined} ${who}`,
      detail: "All other hours are open to play for users (6:00 AM – 10:20 PM).",
    };
  };

  // Dynamic status text for the bottom status bar
  const scheduleSummary = useMemo(() => {
    if (currentHoliday) {
      return {
        isHoliday: true,
        text: `Facility is closed all day for ${currentHoliday.name}. All 3 courts are closed.`,
      };
    }

    const courtBookingsMap: Record<number, string[]> = { 1: [], 2: [], 3: [] };

    [1, 2, 3].forEach((cNum) => {
      const items = getCourtBookings(cNum);
      items.forEach((item) => {
        courtBookingsMap[cNum].push(
          `${formatTime12h(item.startTimeStr)} to ${formatTime12h(item.endTimeStr)}${
            item.department ? ` for ${item.department} department` : ` for ${item.title}`
          }`
        );
      });
    });

    const bookedCourts = [1, 2, 3].filter((c) => courtBookingsMap[c].length > 0);

    if (bookedCourts.length === 0) {
      return {
        isHoliday: false,
        allOpen: true,
        text: "All 3 courts are fully open to play for users today.",
        subtext: "Operating Hours: 6:00 AM – 10:20 PM.",
      };
    }

    const bookingLines = bookedCourts.map((c) => {
      return `Court C${c} is booked from ${courtBookingsMap[c].join(" and ")}`;
    });

    const freeCourts = [1, 2, 3].filter((c) => !bookedCourts.includes(c));
    const freeText =
      freeCourts.length > 0
        ? `Court ${freeCourts.map((c) => `C${c}`).join(" & ")} remain${
            freeCourts.length === 1 ? "s" : ""
          } open to play for users.`
        : "";

    return {
      isHoliday: false,
      allOpen: false,
      text: `${bookingLines.join(". ")}.`,
      subtext: freeText,
    };
  }, [matches, reservations, selectedDate, currentHoliday]);

  // All bookings history sorted by date descending (newest first)
  const allBookingsHistory = useMemo(() => {
    return [...reservations].sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return a.start_time.localeCompare(b.start_time);
    });
  }, [reservations]);

  const upcomingCount = useMemo(() => {
    return allBookingsHistory.filter((item) => item.date >= todayStr).length;
  }, [allBookingsHistory, todayStr]);

  const pastCount = useMemo(() => {
    return allBookingsHistory.filter((item) => item.date < todayStr).length;
  }, [allBookingsHistory, todayStr]);

  const filteredHistory = useMemo(() => {
    return allBookingsHistory.filter((item) => {
      // Tab filter
      if (historyTab === "upcoming" && item.date < todayStr) return false;
      if (historyTab === "past" && item.date >= todayStr) return false;

      // Search filter
      if (historySearch.trim()) {
        const query = historySearch.toLowerCase().trim();
        const matchesName = item.tournament_name.toLowerCase().includes(query);
        const matchesDept = (item.department || "").toLowerCase().includes(query);
        const matchesDate = item.date.includes(query);
        const matchesCourts = item.courts.some(
          (c) => `c${c}`.includes(query) || `court ${c}`.includes(query)
        );
        return matchesName || matchesDept || matchesDate || matchesCourts;
      }
      return true;
    });
  }, [allBookingsHistory, historyTab, historySearch, todayStr]);

  // Open booking modal for adding or updating
  const handleOpenAddBooking = (courtPreset?: number) => {
    setEditingBookingId(null);
    setBookingTournament("");
    setBookingDepartment("");
    setBookingDates([selectedDate]);
    setNewDateInput(selectedDate);
    setDateRangeStart(selectedDate);
    setDateRangeEnd(selectedDate);
    setDateSelectionMode("individual");
    if (courtPreset) {
      setBookingCourts([String(courtPreset)]);
    } else {
      setBookingCourts(["1"]);
    }
    setBookingSlot("09:00-13:00");
    setCustomStart("09:00");
    setCustomEnd("13:00");
    setSelectedCourtDetails(null);
    setShowAdminBookingModal(true);
  };

  // Open booking modal to edit an existing reservation
  const handleEditBooking = (b: BookingDisplayItem) => {
    setEditingBookingId(b.id);
    setBookingTournament(b.title);
    setBookingDepartment(b.department || "");
    const initialDate = b.date || selectedDate;
    setBookingDates([initialDate]);
    setNewDateInput(initialDate);
    setDateRangeStart(initialDate);
    setDateRangeEnd(initialDate);
    setDateSelectionMode("individual");
    setBookingCourts(
      b.courts && b.courts.length > 0 ? b.courts : [String(selectedCourtDetails || "1")]
    );

    const slotMatch = `${b.startTimeStr}-${b.endTimeStr}`;
    if (["09:00-13:00", "13:00-17:00", "09:00-17:00"].includes(slotMatch)) {
      setBookingSlot(slotMatch);
    } else {
      setBookingSlot("custom");
      setCustomStart(b.startTimeStr);
      setCustomEnd(b.endTimeStr);
    }

    setSelectedCourtDetails(null);
    setShowAdminBookingModal(true);
  };

  // Admin: Save or Update Booking
  const handleSaveBooking = async () => {
    if (!bookingTournament.trim()) {
      toast.error("Please enter a Tournament or Event Name");
      return;
    }
    if (bookingDates.length === 0) {
      toast.error("Please select at least one date");
      return;
    }
    if (bookingCourts.length === 0) {
      toast.error("Please select at least one court");
      return;
    }

    let startTime = customStart;
    let endTime = customEnd;

    if (bookingSlot === "09:00-13:00") {
      startTime = "09:00";
      endTime = "13:00";
    } else if (bookingSlot === "13:00-17:00") {
      startTime = "13:00";
      endTime = "17:00";
    } else if (bookingSlot === "09:00-17:00") {
      startTime = "09:00";
      endTime = "17:00";
    }

    setIsSavingBooking(true);
    try {
      let nextReservations: CourtReservation[];

      if (editingBookingId) {
        // Edit existing: update first date on primary reservation, add extra dates as new reservations
        const primaryDate = bookingDates[0];
        const extraDates = bookingDates.slice(1);

        const updatedPrimary: CourtReservation = {
          id: editingBookingId,
          tournament_name: bookingTournament.trim(),
          department: bookingDepartment.trim() || undefined,
          date: primaryDate,
          courts: [...bookingCourts].sort(),
          start_time: startTime,
          end_time: endTime,
        };

        const extraReservations: CourtReservation[] = extraDates.map((dateItem, idx) => ({
          id: `res_${Date.now()}_${idx}`,
          tournament_name: bookingTournament.trim(),
          department: bookingDepartment.trim() || undefined,
          date: dateItem,
          courts: [...bookingCourts].sort(),
          start_time: startTime,
          end_time: endTime,
          created_at: new Date().toISOString(),
        }));

        nextReservations = reservations
          .map((r) => (r.id === editingBookingId ? updatedPrimary : r))
          .concat(extraReservations);
      } else {
        // Create new reservations for ALL selected dates
        const newReservations: CourtReservation[] = bookingDates.map((dateItem, idx) => ({
          id: `res_${Date.now()}_${idx}`,
          tournament_name: bookingTournament.trim(),
          department: bookingDepartment.trim() || undefined,
          date: dateItem,
          courts: [...bookingCourts].sort(),
          start_time: startTime,
          end_time: endTime,
          created_at: new Date().toISOString(),
        }));
        nextReservations = [...reservations, ...newReservations];
      }

      const { error } = await supabase
        .from("site_data")
        .upsert(
          { key: "court_reservations", value: nextReservations as any },
          { onConflict: "key" }
        );

      if (error) throw error;

      setReservations(nextReservations);
      toast.success(
        editingBookingId
          ? "Court booking updated successfully!"
          : `Court booking created for ${bookingDates.length} date${bookingDates.length > 1 ? "s" : ""}!`
      );
      setShowAdminBookingModal(false);
      setEditingBookingId(null);
      setBookingTournament("");
      setBookingDepartment("");
    } catch (err: any) {
      toast.error(err.message || "Failed to save booking");
    } finally {
      setIsSavingBooking(false);
    }
  };

  // Admin: Delete Reservation
  const handleDeleteReservation = async (reservationId: string) => {
    try {
      const nextReservations = reservations.filter((r) => r.id !== reservationId);
      const { error } = await supabase
        .from("site_data")
        .upsert(
          { key: "court_reservations", value: nextReservations as any },
          { onConflict: "key" }
        );

      if (error) throw error;

      setReservations(nextReservations);
      toast.success("Booking removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove booking");
    }
  };

  return (
    <section className="py-5 sm:py-8 bg-slate-900/60 border-t border-slate-800">
      <style>{`
        .custom-picker-input::-webkit-calendar-picker-indicator {
          opacity: 0 !important;
          position: absolute !important;
          right: 0 !important;
          top: 0 !important;
          bottom: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          cursor: pointer !important;
        }
      `}</style>
      <div className="container mx-auto px-2.5 sm:px-4 max-w-6xl">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden">
          {/* Accent Header Bar */}
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500" />

          <div className="p-3.5 sm:p-7">
            {/* Top row: Title, Admin Add Booking & Booking Rules */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 pb-4 sm:pb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-inner">
                  <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-2xl font-black text-white tracking-tight">
                      Court Availability & Schedule
                    </h2>
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                    Operating Hours: 6:00 AM – 10:20 PM
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
                {isAuthorizedAdmin && (
                  <button
                    onClick={() => handleOpenAddBooking()}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 whitespace-nowrap flex-shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Booking</span>
                  </button>
                )}

                <button
                  onClick={() => setShowTimelineModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-all hover:border-teal-500/50 shadow-sm"
                >
                  <CalendarRange className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400" />
                  <span>Timeline</span>
                </button>

                <button
                  onClick={() => setShowRulesModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-all hover:border-emerald-500/50 shadow-sm"
                >
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  <span>Rules</span>
                </button>
              </div>
            </div>

            {/* Date Navigator Bar */}
            <div className="my-4 sm:my-5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
              {/* Infinite Scrollable Date Strip with Today Jump Button and Left / Right Arrows */}
              <div className="flex items-center gap-1.5 w-full md:max-w-[70%] lg:max-w-[74%] min-w-0">
                {/* Jump to Today Button */}
                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className={cn(
                    "px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 flex-shrink-0 border shadow-sm",
                    selectedDate === todayStr
                      ? "bg-emerald-950/90 text-emerald-400 border-emerald-800"
                      : "bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/60"
                  )}
                  title="Jump to Today's date"
                >
                  <span>Today</span>
                </button>

                <button
                  type="button"
                  onClick={() => scrollDateStrip("left")}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                  title="Scroll earlier dates"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div
                  ref={dateStripRef}
                  className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none flex-1 min-w-0"
                >
                  {quickDays.map((q) => {
                    const isSelected = selectedDate === q.dateStr;
                    return (
                      <button
                        key={q.dateStr}
                        data-date={q.dateStr}
                        onClick={() => {
                          setSelectedDate(q.dateStr);
                          scrollToDate(q.dateStr, true);
                        }}
                        className={cn(
                          "w-[104px] sm:w-[114px] min-w-[104px] sm:min-w-[114px] py-1.5 sm:py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 flex-shrink-0 font-bold",
                          isSelected
                            ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/25 scale-[1.02]"
                            : "bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
                        )}
                      >
                        <span className="truncate">{q.dayName}</span>
                        <span
                          className={cn(
                            "text-[10px] sm:text-[11px] font-semibold whitespace-nowrap",
                            isSelected ? "text-slate-900" : "text-slate-400"
                          )}
                        >
                          {q.formattedDate}
                        </span>
                        {q.isHoliday ? (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse flex-shrink-0"
                            title={`Gymkhana Holiday: ${q.holidayName || ""}`}
                          />
                        ) : q.bookingCount > 0 ? (
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full flex-shrink-0",
                              isSelected
                                ? "bg-rose-950 ring-2 ring-rose-900"
                                : "bg-rose-400 animate-pulse"
                            )}
                            title={`${q.bookingCount} event reservation(s) on this date`}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => scrollDateStrip("right")}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                  title="Scroll later dates"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Custom Date Input with Visible Calendar Icon at the Rightmost */}
              <div className="flex items-center justify-end w-full sm:w-auto">
                <div className="relative flex items-center w-full sm:w-auto">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) setSelectedDate(e.target.value);
                    }}
                    style={{ colorScheme: "dark" }}
                    className="custom-picker-input w-full sm:w-[150px] pl-3.5 pr-10 py-1.5 rounded-xl text-xs font-bold border border-slate-700 bg-slate-950 text-slate-100 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]"
                  />
                  <Calendar className="w-4 h-4 text-emerald-400 absolute right-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Holiday State Alert */}
            {currentHoliday ? (
              <div className="p-4 sm:p-6 rounded-2xl bg-rose-950/30 border border-rose-900/60 text-center sm:text-left flex flex-col sm:flex-row items-center gap-3.5 my-4">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-rose-900/50 text-rose-400 border border-rose-800 flex items-center justify-center flex-shrink-0">
                  <CalendarX className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-600 text-white">
                      Closed
                    </span>
                    <h3 className="font-black text-sm sm:text-base text-rose-200">
                      {currentHoliday.name} — Facility Closed All Day
                    </h3>
                  </div>
                  <p className="text-xs text-rose-300/80 mt-1">
                    All 3 courts are closed as per official Gymkhana holidays. Tournament matches and play for users are not permitted on this day.
                  </p>
                </div>
              </div>
            ) : (
              /* ── VISUAL TIMELINE BAR (6:00 AM to 10:20 PM) ── */
              <div className="space-y-3 sm:space-y-4 my-2">
                {/* Time Axis Header (Desktop) */}
                <div className="hidden sm:grid grid-cols-[56px_1fr] gap-3 items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  <span className="text-center">Court</span>
                  <div className="relative w-full h-5">
                    <span className="absolute left-0">6 AM</span>
                    <span className="absolute left-[18.4%] -translate-x-1/2">9 AM</span>
                    <span className="absolute left-[42.9%] -translate-x-1/2">1 PM</span>
                    <span className="absolute left-[67.3%] -translate-x-1/2">5 PM</span>
                    <span className="absolute right-0">10:20 PM</span>
                  </div>
                </div>

                {/* 3 Courts Timeline Bars */}
                <div className="space-y-2.5 sm:space-y-3">
                  {[1, 2, 3].map((courtNum) => {
                    const bookedBlocks = getCourtBookings(courtNum);

                    return (
                      <div
                        key={courtNum}
                        onClick={() => setSelectedCourtDetails(courtNum)}
                        className="p-2.5 sm:p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 hover:border-emerald-500/50 cursor-pointer transition-all group"
                      >
                        {/* Court Badge & Operating Hours */}
                        <div className="flex sm:flex-col items-center justify-between sm:justify-center sm:w-12 flex-shrink-0">
                          <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-800 border border-slate-700/80 text-emerald-400 font-black text-xs sm:text-sm flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                            C{courtNum}
                          </span>
                          <span className="hidden sm:block text-[9px] text-slate-400 font-semibold mt-1 tracking-tight">
                            Mat {courtNum}
                          </span>
                          <span className="sm:hidden text-[10px] text-slate-400 font-bold tracking-wider">
                            6 AM – 10:20 PM
                          </span>
                        </div>

                        {/* Solid Timeline Bar - Fixed rock-solid height on small screens, expands on desktop */}
                        <div className="relative w-full sm:flex-1 h-8 sm:h-9 min-h-[32px] sm:min-h-[36px] rounded-xl overflow-hidden bg-emerald-500 border border-emerald-400/40 shadow-inner flex items-center">
                          {/* Faint dashed vertical time guidelines across bar: 9 AM (18.4%), 1 PM (42.9%), 5 PM (67.3%) */}
                          <div className="absolute inset-0 pointer-events-none z-10">
                            <div className="absolute top-0 bottom-0 left-[18.4%] border-l border-emerald-700/40 border-dashed" />
                            <div className="absolute top-0 bottom-0 left-[42.9%] border-l border-emerald-700/40 border-dashed" />
                            <div className="absolute top-0 bottom-0 left-[67.3%] border-l border-emerald-700/40 border-dashed" />
                          </div>

                          {/* Red Booked Blocks */}
                          {bookedBlocks.map((b) => (
                            <div
                              key={b.id}
                              style={{
                                left: `${b.leftPercent}%`,
                                width: `${Math.max(b.widthPercent, 6)}%`,
                              }}
                              className="absolute top-0 bottom-0 bg-rose-600 hover:bg-rose-500 transition-colors z-20 flex items-center justify-center px-1 text-[9px] sm:text-[10px] font-black text-white truncate shadow-md border-x border-rose-400/50"
                              title={`${b.title} (${formatTime12h(b.startTimeStr)}–${formatTime12h(b.endTimeStr)})`}
                            >
                              <span className="truncate">{b.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Helpful click guidance note - Optimized for small screens */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 text-[11px] text-slate-400 px-1 pt-1">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-slate-300">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500 border border-emerald-400/40" />
                      <span>Open to play</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-slate-300">
                      <span className="w-2.5 h-2.5 rounded bg-rose-600 border border-rose-400/40" />
                      <span>Booked</span>
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 hover:text-emerald-400 transition-colors">
                    Click any court bar for full details
                  </span>
                </div>
              </div>
            )}

            {/* Dynamic Status Summary in Footer */}
            <div className="mt-3.5 sm:mt-4 p-3.5 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-2.5 sm:gap-3 shadow-inner">
              <div
                className={cn(
                  "w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full mt-1 flex-shrink-0 animate-pulse",
                  scheduleSummary.isHoliday
                    ? "bg-rose-500"
                    : scheduleSummary.allOpen
                    ? "bg-emerald-400"
                    : "bg-amber-400"
                )}
              />
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                  {scheduleSummary.text}
                </p>
                {scheduleSummary.subtext && (
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-1 font-medium">
                    {scheduleSummary.subtext}
                  </p>
                )}
              </div>
            </div>

            {/* ── BOOKING HISTORY SECTION (Collapsed by Default) ── */}
            <div className="mt-4 sm:mt-5 border-t border-slate-800 pt-3 sm:pt-4">
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                    <History className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-xs sm:text-sm text-white truncate">
                      Booking History & Scheduled Events
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                      {showHistory
                        ? "Click to collapse"
                        : "Click to expand all past & upcoming court reservations"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 ml-3">
                  <span className="text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/80 whitespace-nowrap shadow-sm">
                    {allBookingsHistory.length} Record{allBookingsHistory.length !== 1 ? "s" : ""}
                  </span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                    {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {/* Collapsed Body */}
              {showHistory && (
                <div className="mt-3.5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Controls: Filter Tabs + Quick Search */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                    {/* Tabs */}
                    <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner overflow-x-auto scrollbar-none">
                      <button
                        type="button"
                        onClick={() => setHistoryTab("upcoming")}
                        className={cn(
                          "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                          historyTab === "upcoming"
                            ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                        )}
                      >
                        <span>Upcoming</span>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center inline-flex items-center justify-center leading-none",
                            historyTab === "upcoming"
                              ? "bg-slate-950/25 text-slate-950 font-black"
                              : "bg-slate-850 text-slate-400 border border-slate-800"
                          )}
                        >
                          {upcomingCount}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHistoryTab("past")}
                        className={cn(
                          "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                          historyTab === "past"
                            ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                        )}
                      >
                        <span>Completed</span>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center inline-flex items-center justify-center leading-none",
                            historyTab === "past"
                              ? "bg-slate-950/25 text-slate-950 font-black"
                              : "bg-slate-850 text-slate-400 border border-slate-800"
                          )}
                        >
                          {pastCount}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHistoryTab("all")}
                        className={cn(
                          "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                          historyTab === "all"
                            ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                        )}
                      >
                        <span>All</span>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center inline-flex items-center justify-center leading-none",
                            historyTab === "all"
                              ? "bg-slate-950/25 text-slate-950 font-black"
                              : "bg-slate-850 text-slate-400 border border-slate-800"
                          )}
                        >
                          {allBookingsHistory.length}
                        </span>
                      </button>
                    </div>

                    {/* Quick Search */}
                    <div className="relative flex items-center min-w-[200px] sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder="Search event or dept..."
                        className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-medium"
                      />
                      {historySearch && (
                        <button
                          type="button"
                          onClick={() => setHistorySearch("")}
                          className="absolute right-2 text-slate-400 hover:text-white p-0.5"
                          title="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scrollable Container with Max Height */}
                  <div className="max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {filteredHistory.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-1 my-1">
                        <p className="font-bold text-slate-300">No court bookings found.</p>
                        <p className="text-[11px] text-slate-500">
                          {historyTab === "upcoming"
                            ? "No upcoming tournaments currently scheduled."
                            : historyTab === "past"
                            ? "No completed tournaments found."
                            : "Try clearing your search query."}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 pb-1">
                        {filteredHistory.map((item) => {
                          const isPast = item.date < todayStr;
                          const isToday = item.date === todayStr;

                          const dateFormatted = new Date(item.date + "T12:00:00").toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          });

                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "p-3.5 rounded-2xl flex flex-col justify-between gap-2.5 text-xs transition-all",
                                isPast
                                  ? "bg-slate-950/60 border border-slate-850 hover:border-slate-700/80 opacity-80 hover:opacity-100"
                                  : "bg-gradient-to-br from-slate-950 via-slate-950 to-emerald-950/20 border border-emerald-900/40 hover:border-emerald-600/60 shadow-lg shadow-emerald-950/10"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-black text-white text-sm truncate">
                                      {item.tournament_name}
                                    </span>
                                    <span
                                      className={cn(
                                        "text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1",
                                        isToday
                                          ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                                          : isPast
                                          ? "bg-slate-800 text-slate-400 border-slate-700/80"
                                          : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                      )}
                                    >
                                      {!isPast && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                      )}
                                      {isToday ? "Today" : isPast ? "Completed" : "Upcoming"}
                                    </span>
                                  </div>
                                  {item.department && (
                                    <p className="text-slate-400 text-xs mt-0.5 font-medium truncate">
                                      {item.department} Department
                                    </p>
                                  )}
                                </div>

                                {isAuthorizedAdmin && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      onClick={() => {
                                        setEditingBookingId(item.id);
                                        setBookingTournament(item.tournament_name);
                                        setBookingDepartment(item.department || "");
                                        setBookingDates([item.date]);
                                        setNewDateInput(item.date);
                                        setDateRangeStart(item.date);
                                        setDateRangeEnd(item.date);
                                        setDateSelectionMode("individual");
                                        setBookingCourts(item.courts);

                                        const slotMatch = `${item.start_time}-${item.end_time}`;
                                        if (["09:00-13:00", "13:00-17:00", "09:00-17:00"].includes(slotMatch)) {
                                          setBookingSlot(slotMatch);
                                        } else {
                                          setBookingSlot("custom");
                                          setCustomStart(item.start_time);
                                          setCustomEnd(item.end_time);
                                        }

                                        setShowAdminBookingModal(true);
                                      }}
                                      title="Edit booking"
                                      className="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-750 text-slate-300 hover:text-white transition-colors"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        setDeleteConfirmBooking({
                                          id: item.id,
                                          title: item.tournament_name,
                                          date: item.date,
                                          courts: item.courts,
                                        })
                                      }
                                      title="Delete booking"
                                      className="p-1.5 rounded-lg bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-900 text-[11px] text-slate-400">
                                <span className="flex items-center gap-1 font-medium text-slate-300">
                                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                                  {dateFormatted}
                                </span>
                                <span className="flex items-center gap-1 font-bold text-slate-200">
                                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                                  {formatTime12h(item.start_time)} – {formatTime12h(item.end_time)}
                                </span>
                                <div className="flex items-center gap-1">
                                  {item.courts.map((c) => (
                                    <span
                                      key={c}
                                      className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] font-black border",
                                        isPast
                                          ? "bg-slate-800 text-slate-400 border-slate-700"
                                          : "bg-emerald-950 text-emerald-400 border-emerald-800/80"
                                      )}
                                    >
                                      C{c}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── COURT DETAILS POPUP MODAL (When clicking any court bar) ── */}
      {selectedCourtDetails !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedCourtDetails(null)}
        >
          <div
            className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 font-black text-xs sm:text-sm flex items-center justify-center shadow-inner">
                  C{selectedCourtDetails}
                </span>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-white">
                    Court C{selectedCourtDetails} Details
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCourtDetails(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto">
              {(() => {
                const info = getCourtStatusInfo(selectedCourtDetails);
                const bookings = getCourtBookings(selectedCourtDetails);

                if (info.isHoliday) {
                  return (
                    <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300">
                      <span className="font-black text-rose-200 block text-sm mb-1">
                        Facility Closed
                      </span>
                      {info.summary}
                    </div>
                  );
                }

                if (!info.isBooked) {
                  return (
                    <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/70 text-emerald-300 text-xs flex items-center gap-3.5 shadow-inner">
                      <div className="w-10 h-10 rounded-xl bg-emerald-900/50 border border-emerald-700/60 flex items-center justify-center text-emerald-400 flex-shrink-0">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-black text-sm text-emerald-200">
                          Court is open to play for users
                        </p>
                        <p className="text-emerald-400/90 mt-0.5 font-medium">
                          {info.detail}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3.5">
                    {/* Primary Status Banner */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-950/30 border border-rose-900/60 text-xs">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-black text-xs sm:text-sm text-rose-200 leading-snug">
                            {info.summary}
                          </p>
                          <p className="text-rose-300/80 mt-1 font-medium text-[11px]">
                            {info.detail}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Booking Breakdown List */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-300">
                        Scheduled Bookings on Court C{selectedCourtDetails}:
                      </p>
                      {bookings.map((b) => (
                        <div
                          key={b.id}
                          className="p-3 sm:p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <span className="font-black text-white text-sm block">
                              {b.title}
                            </span>
                            {b.department && (
                              <span className="text-slate-300 text-xs block font-semibold">
                                {b.department} Department
                              </span>
                            )}
                            <div className="flex items-center gap-2 pt-0.5">
                              <span className="inline-block px-2.5 py-0.5 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-900 font-bold text-[11px]">
                                {formatTime12h(b.startTimeStr)} – {formatTime12h(b.endTimeStr)}
                              </span>
                              {b.isManual && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  Manual Booking
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Admin Edit / Delete Actions */}
                          {isAuthorizedAdmin && b.isManual && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditBooking(b)}
                                title="Edit booking"
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteConfirmBooking({
                                    id: b.id,
                                    title: b.title,
                                    date: b.date || selectedDate,
                                    courts: b.courts || [String(selectedCourtDetails)],
                                  })
                                }
                                title="Delete booking"
                                className="p-1.5 rounded-lg bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400">
                      All other hours are open to play for users.
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              {isAuthorizedAdmin && (
                <button
                  onClick={() => handleOpenAddBooking(selectedCourtDetails)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Update / Add Booking</span>
                </button>
              )}
              <button
                onClick={() => setSelectedCourtDetails(null)}
                className="ml-auto px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN BOOKING MODAL (Add / Update Booking) ── */}
      {showAdminBookingModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => {
            setShowAdminBookingModal(false);
            setEditingBookingId(null);
          }}
        >
          <div
            className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-white">
                    {editingBookingId ? "Edit Court Booking" : "Update / Add Court Booking"}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    Administrator booking control
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAdminBookingModal(false);
                  setEditingBookingId(null);
                }}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Event / Tournament Name */}
              <div>
                <label className="font-bold text-slate-200 block mb-1">
                  Tournament / Event Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Faculty Club, Materials Sports Day"
                  value={bookingTournament}
                  onChange={(e) => setBookingTournament(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Department */}
              <div>
                <label className="font-bold text-slate-200 block mb-1">
                  Department / Organizing Body
                </label>
                <input
                  type="text"
                  placeholder="e.g. Materials Science, Aerospace, CSA"
                  value={bookingDepartment}
                  onChange={(e) => setBookingDepartment(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Multiple Date Selection (Specific Dates or Date Range) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-200">
                    Dates (Select Multiple) *
                  </label>
                  <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDateSelectionMode("individual")}
                      className={cn(
                        "px-2 py-0.5 rounded-md font-bold transition-colors",
                        dateSelectionMode === "individual"
                          ? "bg-emerald-500 text-slate-950"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Specific Dates
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateSelectionMode("range");
                        if (bookingDates.length > 0) {
                          setDateRangeStart(bookingDates[0]);
                          setDateRangeEnd(bookingDates[bookingDates.length - 1]);
                        }
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded-md font-bold transition-colors",
                        dateSelectionMode === "range"
                          ? "bg-emerald-500 text-slate-950"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Date Range
                    </button>
                  </div>
                </div>

                {dateSelectionMode === "individual" ? (
                  <div className="space-y-2">
                    {/* Quick Upcoming Day Chips (Toggleable pills) with Left / Right Arrows */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => scrollDateStrip("left", true)}
                        className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex-shrink-0"
                        title="Scroll earlier dates"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>

                      <div
                        ref={modalDateStripRef}
                        className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth flex-1 min-w-0"
                      >
                        {quickDays.map((q) => {
                          const isSelected = bookingDates.includes(q.dateStr);
                          return (
                            <button
                              key={q.dateStr}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  if (bookingDates.length > 1) {
                                    setBookingDates((prev) => prev.filter((d) => d !== q.dateStr));
                                  } else {
                                    toast.error("At least one date must be selected");
                                  }
                                } else {
                                  setBookingDates((prev) => [...prev, q.dateStr].sort());
                                }
                              }}
                              className={cn(
                                "w-[96px] sm:w-[104px] min-w-[96px] sm:min-w-[104px] py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 flex-shrink-0 border",
                                isSelected
                                  ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm"
                                  : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                              )}
                            >
                              <span className="truncate">{q.dayName}</span>
                              <span
                                className={cn(
                                  "text-[10px] whitespace-nowrap",
                                  isSelected ? "text-slate-900 font-black" : "text-slate-500"
                                )}
                              >
                                {q.formattedDate}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => scrollDateStrip("right", true)}
                        className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex-shrink-0"
                        title="Scroll future dates"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Custom Date Picker to add any additional date */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 flex items-center">
                        <input
                          type="date"
                          value={newDateInput}
                          onChange={(e) => setNewDateInput(e.target.value)}
                          style={{ colorScheme: "dark" }}
                          className="custom-picker-input w-full pl-3 pr-10 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer [color-scheme:dark]"
                        />
                        <Calendar className="w-4 h-4 text-emerald-400 absolute right-3 pointer-events-none" />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newDateInput) return;
                          if (bookingDates.includes(newDateInput)) {
                            toast.info("Date already added");
                            return;
                          }
                          setBookingDates((prev) => [...prev, newDateInput].sort());
                          toast.success("Date added to selection");
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 flex items-center gap-1 transition-colors flex-shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Date</span>
                      </button>
                    </div>

                    {/* Selected Dates Display Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {bookingDates.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 font-bold text-[11px]"
                        >
                          <span>
                            {new Date(d + "T12:00:00").toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          {bookingDates.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setBookingDates((prev) => prev.filter((item) => item !== d))}
                              className="w-4 h-4 rounded-full hover:bg-emerald-900/80 flex items-center justify-center text-emerald-400 hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Date Range Picker */
                  <div className="space-y-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">
                          From Date
                        </span>
                        <div className="relative flex items-center">
                          <input
                            type="date"
                            value={dateRangeStart}
                            onChange={(e) => {
                              setDateRangeStart(e.target.value);
                              applyDateRange(e.target.value, dateRangeEnd);
                            }}
                            style={{ colorScheme: "dark" }}
                            className="custom-picker-input w-full pl-2.5 pr-8 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 font-bold text-xs cursor-pointer [color-scheme:dark]"
                          />
                          <Calendar className="w-3.5 h-3.5 text-emerald-400 absolute right-2 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">
                          To Date
                        </span>
                        <div className="relative flex items-center">
                          <input
                            type="date"
                            value={dateRangeEnd}
                            onChange={(e) => {
                              setDateRangeEnd(e.target.value);
                              applyDateRange(dateRangeStart, e.target.value);
                            }}
                            style={{ colorScheme: "dark" }}
                            className="custom-picker-input w-full pl-2.5 pr-8 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 font-bold text-xs cursor-pointer [color-scheme:dark]"
                          />
                          <Calendar className="w-3.5 h-3.5 text-emerald-400 absolute right-2 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-400 font-semibold pt-1">
                      ✓ Selected {bookingDates.length} consecutive days (
                      {bookingDates
                        .map((d) =>
                          new Date(d + "T12:00:00").toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })
                        )
                        .join(", ")}
                      )
                    </p>
                  </div>
                )}
              </div>

              {/* Multiple Court Selection */}
              <div>
                <label className="font-bold text-slate-200 block mb-1.5">
                  Courts (Select Multiple) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["1", "2", "3"].map((cNum) => {
                    const isSelected = bookingCourts.includes(cNum);
                    return (
                      <button
                        key={cNum}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (bookingCourts.length > 1) {
                              setBookingCourts((prev) => prev.filter((c) => c !== cNum));
                            } else {
                              toast.error("At least one court must be selected");
                            }
                          } else {
                            setBookingCourts((prev) => [...prev, cNum].sort());
                          }
                        }}
                        className={cn(
                          "py-2.5 rounded-xl font-black text-xs transition-all border",
                          isSelected
                            ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                            : "bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-600"
                        )}
                      >
                        Court C{cNum}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <label className="font-bold text-slate-200 block mb-1.5">
                  Time Slot *
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[
                    { id: "09:00-13:00", label: "9:00 AM – 1:00 PM" },
                    { id: "13:00-17:00", label: "1:00 PM – 5:00 PM" },
                    { id: "09:00-17:00", label: "Full Day (9 AM – 5 PM)" },
                    { id: "custom", label: "Custom Time" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setBookingSlot(s.id)}
                      className={cn(
                        "py-2 px-2.5 rounded-xl font-bold text-xs transition-all border text-center",
                        bookingSlot === s.id
                          ? "bg-slate-800 text-emerald-400 border-emerald-500/80 shadow-sm"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {bookingSlot === "custom" && (
                  <div className="grid grid-cols-2 gap-2 mt-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1 font-medium">
                        Start Time
                      </span>
                      <div className="relative flex items-center">
                        <input
                          type="time"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          style={{ colorScheme: "dark" }}
                          className="custom-picker-input w-full pl-3 pr-9 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold [color-scheme:dark] cursor-pointer"
                        />
                        <Clock className="w-4 h-4 text-emerald-400 absolute right-2.5 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1 font-medium">
                        End Time
                      </span>
                      <div className="relative flex items-center">
                        <input
                          type="time"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          style={{ colorScheme: "dark" }}
                          className="custom-picker-input w-full pl-3 pr-9 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold [color-scheme:dark] cursor-pointer"
                        />
                        <Clock className="w-4 h-4 text-emerald-400 absolute right-2.5 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAdminBookingModal(false);
                  setEditingBookingId(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBooking}
                disabled={isSavingBooking}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                {isSavingBooking
                  ? "Saving..."
                  : editingBookingId
                  ? "Update Booking"
                  : "Save Booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOOKING RULES POPUP / MODAL (Scrollable) ── */}
      {showRulesModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setShowRulesModal(false)}
        >
          <div
            className="relative w-full max-w-xl max-h-[85vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-white">
                    Gymkhana Court Booking Rules
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    Interim regulations for tournament bookings & play for users
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto text-xs text-slate-300 scrollbar-thin">
              <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-900/40 text-blue-200 leading-relaxed">
                <span className="font-bold text-white block mb-0.5">Interim Measure Notice</span>
                These guidelines remain in effect until the new Gymkhana 10-court badminton facility becomes operational, ensuring fair access for both tournament organizers and everyday players.
              </div>

              {/* Rule 1 */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-white text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[11px]">1</span>
                    Court Allocation
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    1 Court Max
                  </span>
                </div>
                <ul className="space-y-1 text-slate-400 list-disc list-inside pl-1 pt-1">
                  <li>Departmental and divisional tournaments may reserve a <strong className="text-slate-200">maximum of 1 court</strong> at a time.</li>
                  <li>At least <strong className="text-slate-200">2 courts must remain open</strong> to play for users.</li>
                  <li>Institute-level and inter-institute events may reserve up to 3 courts with prior Gymkhana approval.</li>
                </ul>
              </div>

              {/* Rule 2 */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-white text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[11px]">2</span>
                    Booking Timings
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    Day Slots Only
                  </span>
                </div>
                <ul className="space-y-1 text-slate-400 list-disc list-inside pl-1 pt-1">
                  <li>Departmental bookings are permitted only in two daytime windows: <strong className="text-slate-200">9:00 AM – 1:00 PM</strong> and <strong className="text-slate-200">1:00 PM – 5:00 PM</strong>.</li>
                  <li><strong className="text-rose-400">No departmental bookings are allowed after 5:00 PM</strong> on weekdays or weekends.</li>
                </ul>
              </div>

              {/* Rule 3 */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-950/15 border border-emerald-900/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-emerald-300 text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 font-bold flex items-center justify-center text-[11px]">3</span>
                    Protected Evening Hours
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                    5:00 PM – 10:20 PM
                  </span>
                </div>
                <ul className="space-y-1 text-slate-300 list-disc list-inside pl-1 pt-1">
                  <li>Evening hours are strictly preserved for play for users and recreational players.</li>
                  <li>Only approved institute-level tournaments may be granted evening exceptions.</li>
                </ul>
              </div>

              {/* Rule 4 */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-white text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[11px]">4</span>
                    Duration Quotas by Participant Count
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    Capped Hours
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Maximum total court hours depend strictly on the number of registered players:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Up to 40</span>
                    <span className="text-sm font-black text-white">8 hours max</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">41 – 60</span>
                    <span className="text-sm font-black text-white">12 hours max</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">61 – 79</span>
                    <span className="text-sm font-black text-white">16 hours max</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">80 or more</span>
                    <span className="text-sm font-black text-white">20 hours max</span>
                  </div>
                </div>
              </div>

              {/* Rule 5 */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-white text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[11px]">5</span>
                    Advance Notice & Holidays
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    &ge; 7 Days
                  </span>
                </div>
                <ul className="space-y-1 text-slate-400 list-disc list-inside pl-1 pt-1">
                  <li>Organizers must submit booking requests at least <strong className="text-slate-200">7 days in advance</strong>.</li>
                  <li>Requests must include tentative participant count, format, and proposed match schedule.</li>
                  <li>Courts are completely <strong className="text-rose-400">closed on all Gymkhana-declared holidays</strong>.</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowRulesModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-md shadow-emerald-500/20"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteConfirmBooking && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setDeleteConfirmBooking(null)}
        >
          <div
            className="relative w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-black text-base text-white">
                Delete Court Booking?
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Are you sure you want to delete the booking for{" "}
                <strong className="text-white font-black">{deleteConfirmBooking.title}</strong> on{" "}
                <span className="text-emerald-400 font-bold">
                  {new Date(deleteConfirmBooking.date + "T12:00:00").toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>{" "}
                ({deleteConfirmBooking.courts.map((c) => `Court C${c}`).join(", ")})?
              </p>
              <p className="text-[11px] text-slate-400 mt-1.5">
                This court will immediately become open to play for users.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmBooking(null)}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteReservation(deleteConfirmBooking.id);
                  setDeleteConfirmBooking(null);
                }}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VERTICAL TIMELINE MODAL (Bookings & Holidays by Month) ── */}
      {showTimelineModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
          onClick={() => setShowTimelineModal(false)}
        >
          <div
            className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Accent Top Bar */}
            <div className="h-1.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-sky-500" />

            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-950 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center flex-shrink-0 shadow-inner">
                  <CalendarRange className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-lg text-white tracking-tight">
                    Facility Schedule & Holiday Timeline
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                    Chronological overview of court tournament reservations & Gymkhana holiday closures
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTimelineModal(false)}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Close timeline"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tabs Header */}
            <div className="px-4 sm:px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none flex-shrink-0">
              <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setTimelineFilter("all")}
                  className={cn(
                    "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                    timelineFilter === "all"
                      ? "bg-teal-500 text-slate-950 font-black shadow-md shadow-teal-500/25"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  )}
                >
                  <span>All Events</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center inline-flex items-center justify-center leading-none",
                      timelineFilter === "all"
                        ? "bg-slate-950/25 text-slate-950 font-black"
                        : "bg-slate-800 text-slate-400 border border-slate-750"
                    )}
                  >
                    {reservations.length + holidays.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTimelineFilter("tournaments")}
                  className={cn(
                    "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                    timelineFilter === "tournaments"
                      ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/25"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  )}
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      timelineFilter === "tournaments" ? "bg-slate-950" : "bg-emerald-400"
                    )}
                  />
                  <span>Tournaments</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center inline-flex items-center justify-center leading-none",
                      timelineFilter === "tournaments"
                        ? "bg-slate-950/25 text-slate-950 font-black"
                        : "bg-slate-800 text-slate-400 border border-slate-750"
                    )}
                  >
                    {reservations.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTimelineFilter("holidays")}
                  className={cn(
                    "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                    timelineFilter === "holidays"
                      ? "bg-rose-500 text-slate-950 font-black shadow-md shadow-rose-500/25"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  )}
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      timelineFilter === "holidays" ? "bg-slate-950" : "bg-rose-400"
                    )}
                  />
                  <span>Holidays</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center inline-flex items-center justify-center leading-none",
                      timelineFilter === "holidays"
                        ? "bg-slate-950/25 text-slate-950 font-black"
                        : "bg-slate-800 text-slate-400 border border-slate-750"
                    )}
                  >
                    {holidays.length}
                  </span>
                </button>
              </div>

              <span className="text-[10px] text-slate-400 hidden sm:inline whitespace-nowrap">
                Click any event to view schedule
              </span>
            </div>

            {/* Scrollable Timeline Body */}
            <div className="px-4 sm:px-6 pb-6 pt-0 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {timelineGroups.length === 0 ? (
                <div className="my-6 p-12 text-center text-xs text-slate-400 rounded-3xl bg-slate-950/40 border border-slate-800 space-y-1">
                  <CalendarX className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-300">No events found.</p>
                  <p className="text-[11px] text-slate-500">
                    No bookings or holidays match the current filter.
                  </p>
                </div>
              ) : (
                timelineGroups.map((group, groupIdx) => {
                  // Distinguish months with color themes
                  const monthColorThemes = [
                    { border: "border-teal-500/40", badge: "bg-teal-950/80 text-teal-300 border-teal-800", dot: "from-teal-400 to-emerald-500" },
                    { border: "border-sky-500/40", badge: "bg-sky-950/80 text-sky-300 border-sky-800", dot: "from-sky-400 to-indigo-500" },
                    { border: "border-amber-500/40", badge: "bg-amber-950/80 text-amber-300 border-amber-800", dot: "from-amber-400 to-orange-500" },
                    { border: "border-emerald-500/40", badge: "bg-emerald-950/80 text-emerald-300 border-emerald-800", dot: "from-emerald-400 to-teal-500" },
                    { border: "border-purple-500/40", badge: "bg-purple-950/80 text-purple-300 border-purple-800", dot: "from-purple-400 to-pink-500" },
                  ];
                  const theme = monthColorThemes[groupIdx % monthColorThemes.length];

                  return (
                    <div key={group.monthKey} className="space-y-3 pt-3">
                      {/* Differentiable Month Header Banner with Translucent Sticky Bar */}
                      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 shadow-md">
                        <div className={cn(
                          "py-2.5 px-3.5 sm:px-4 rounded-2xl bg-slate-900/90 border shadow-lg flex items-center justify-between gap-3",
                          theme.border
                        )}>
                          <div className="flex items-center gap-2.5">
                            <span className={cn("w-3 h-3 rounded-full bg-gradient-to-tr shadow-sm", theme.dot)} />
                            <h4 className="font-black text-sm sm:text-base text-white tracking-wide uppercase">
                              {group.monthLabel}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold">
                            {group.bookingCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/80 whitespace-nowrap">
                                {group.bookingCount} Booking{group.bookingCount > 1 ? "s" : ""}
                              </span>
                            )}
                            {group.holidayCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800/80 whitespace-nowrap">
                                {group.holidayCount} Holiday{group.holidayCount > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Vertical Spine and Event Items */}
                      <div className="relative pl-6 sm:pl-8 space-y-3.5 border-l-2 border-slate-800 ml-4 sm:ml-5 pt-1 pb-2">
                        {group.items.map((item) => {
                          const isHoliday = item.type === "holiday";
                          const d = new Date(item.date + "T12:00:00");
                          const formattedDate = d.toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          });

                          return (
                            <div key={item.id} className="relative group">
                              {/* Spine Node Icon */}
                              <div
                                className={cn(
                                  "absolute -left-[31px] sm:-left-[39px] top-3.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-lg border-2 transition-transform group-hover:scale-110",
                                  isHoliday
                                    ? "bg-rose-950 border-rose-500 text-rose-400 shadow-rose-950/60"
                                    : "bg-emerald-950 border-emerald-500 text-emerald-400 shadow-emerald-950/60"
                                )}
                              >
                                {isHoliday ? (
                                  <CalendarX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                ) : (
                                  <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                )}
                              </div>

                              {/* Event Card */}
                              <div
                                onClick={() => {
                                  setSelectedDate(item.date);
                                  setShowTimelineModal(false);
                                  toast.success(`Showing court schedule for ${formattedDate}`);
                                }}
                                className={cn(
                                  "p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer",
                                  isHoliday
                                    ? "bg-gradient-to-r from-rose-950/40 via-rose-950/20 to-slate-900 border-rose-900/60 hover:border-rose-500/80 shadow-md shadow-rose-950/15 hover:shadow-rose-950/30"
                                    : "bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/25 border-emerald-900/40 hover:border-emerald-500/80 shadow-md shadow-emerald-950/15 hover:shadow-emerald-950/30"
                                )}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={cn(
                                        "text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                        isHoliday
                                          ? "bg-rose-900/80 text-rose-200 border-rose-700"
                                          : "bg-emerald-950 text-emerald-400 border-emerald-800"
                                      )}
                                    >
                                      {isHoliday ? "Gymkhana Holiday" : "Tournament Booking"}
                                    </span>

                                    {!isHoliday && item.courts && (
                                      <div className="flex items-center gap-1">
                                        {item.courts.map((c) => (
                                          <span
                                            key={c}
                                            className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-950 text-emerald-400 border border-emerald-800"
                                          >
                                            Court C{c}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    <span className="text-[11px] sm:text-xs font-bold text-slate-300">
                                      {formattedDate}
                                    </span>
                                  </div>

                                  {!isHoliday && item.startTime && item.endTime && (
                                    <span className="text-[11px] sm:text-xs font-bold text-slate-300 flex items-center gap-1 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                                      <Clock className="w-3.5 h-3.5 text-rose-400" />
                                      {formatTime12h(item.startTime)} – {formatTime12h(item.endTime)}
                                    </span>
                                  )}
                                </div>

                                <div className="mt-2 flex items-baseline justify-between gap-2">
                                  <div>
                                    <h5
                                      className={cn(
                                        "font-black text-sm sm:text-base",
                                        isHoliday ? "text-rose-200" : "text-white"
                                      )}
                                    >
                                      {item.title}
                                    </h5>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                      {isHoliday
                                        ? "Facility & all 3 courts are closed to all play on this day."
                                        : item.department
                                        ? `${item.department} Department`
                                        : "Court reserved for tournament play"}
                                    </p>
                                  </div>

                                  <span className="text-[10px] font-bold text-emerald-400 group-hover:underline flex-shrink-0 self-end">
                                    View in Schedule →
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px] hidden sm:inline">
                Click any tournament or holiday card to view its court schedule on that day
              </span>
              <button
                type="button"
                onClick={() => setShowTimelineModal(false)}
                className="ml-auto px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
