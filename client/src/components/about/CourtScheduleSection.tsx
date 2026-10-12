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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CourtReservation, BookingDisplayItem } from "./courtSchedule.types";
import { DAY_START_MINUTES, DAY_END_MINUTES, TOTAL_MINUTES, formatTime12h, timeStrToMinutes } from "./courtSchedule.utils";
import { useCourtScheduleData } from "./useCourtScheduleData";
import { CourtRulesModal } from "./CourtRulesModal";
import { DeleteBookingConfirmModal } from "./DeleteBookingConfirmModal";
import { CourtTimelineModal } from "./CourtTimelineModal";
import { CourtBookingModal } from "./CourtBookingModal";
import { CourtHistoryPanel } from "./CourtHistoryPanel";
import { CourtDetailsModal } from "./CourtDetailsModal";

export type { CourtReservation, BookingDisplayItem };

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

  // Court schedule data layer (matches, reservations, holidays + realtime).
  const { matches, reservations, setReservations, holidays } = useCourtScheduleData(selectedDate);

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
            <CourtHistoryPanel
              showHistory={showHistory}
              setShowHistory={setShowHistory}
              historyTab={historyTab}
              setHistoryTab={setHistoryTab}
              historySearch={historySearch}
              setHistorySearch={setHistorySearch}
              allBookingsHistory={allBookingsHistory}
              filteredHistoryBookings={filteredHistory}
              todayStr={todayStr}
              isAuthorizedAdmin={isAuthorizedAdmin}
              onOpenAddBooking={() => handleOpenAddBooking()}
              onEditBooking={handleEditBooking}
              onRequestDeleteBooking={setDeleteConfirmBooking}
            />
          </div>
        </div>
      </div>

      {/* ── COURT DETAILS POPUP MODAL (When clicking any court bar) ── */}
      <CourtDetailsModal
        selectedCourtDetails={selectedCourtDetails}
        onClose={() => setSelectedCourtDetails(null)}
        selectedDate={selectedDate}
        courtInfo={selectedCourtDetails !== null ? getCourtStatusInfo(selectedCourtDetails) : { isHoliday: false, isBooked: false, summary: '', detail: '' }}
        bookings={selectedCourtDetails !== null ? getCourtBookings(selectedCourtDetails) : []}
        isAuthorizedAdmin={isAuthorizedAdmin}
        onOpenAddBooking={handleOpenAddBooking}
        onEditBooking={handleEditBooking}
        onRequestDeleteBooking={setDeleteConfirmBooking}
      />

      {/* ── ADMIN BOOKING MODAL (Add / Update Booking) ── */}
      <CourtBookingModal
        isOpen={showAdminBookingModal}
        onClose={() => {
          setShowAdminBookingModal(false);
          setEditingBookingId(null);
        }}
        editingBookingId={editingBookingId}
        bookingTournament={bookingTournament}
        setBookingTournament={setBookingTournament}
        bookingDepartment={bookingDepartment}
        setBookingDepartment={setBookingDepartment}
        bookingDates={bookingDates}
        setBookingDates={setBookingDates}
        dateSelectionMode={dateSelectionMode}
        setDateSelectionMode={setDateSelectionMode}
        newDateInput={newDateInput}
        setNewDateInput={setNewDateInput}
        dateRangeStart={dateRangeStart}
        setDateRangeStart={setDateRangeStart}
        dateRangeEnd={dateRangeEnd}
        setDateRangeEnd={setDateRangeEnd}
        applyDateRange={applyDateRange}
        bookingCourts={bookingCourts}
        setBookingCourts={setBookingCourts}
        bookingSlot={bookingSlot}
        setBookingSlot={setBookingSlot}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        isSavingBooking={isSavingBooking}
        onSaveBooking={handleSaveBooking}
      />

      {/* ── BOOKING RULES POPUP / MODAL (Scrollable) ── */}
      <CourtRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />

      {/* ── DELETE CONFIRMATION MODAL ── */}
      <DeleteBookingConfirmModal
        booking={deleteConfirmBooking}
        onCancel={() => setDeleteConfirmBooking(null)}
        onConfirm={(id) => {
          handleDeleteReservation(id);
          setDeleteConfirmBooking(null);
        }}
      />

      {/* ── VERTICAL TIMELINE MODAL (Bookings & Holidays by Month) ── */}
      <CourtTimelineModal
        isOpen={showTimelineModal}
        onClose={() => setShowTimelineModal(false)}
        timelineFilter={timelineFilter}
        setTimelineFilter={setTimelineFilter}
        reservationsCount={reservations.length}
        holidaysCount={holidays.length}
        timelineGroups={timelineGroups}
        onSelectDate={(date, formattedDate) => {
          setSelectedDate(date);
          setShowTimelineModal(false);
          toast.success(`Showing court schedule for ${formattedDate}`);
        }}
      />
    </section>
  );
}
