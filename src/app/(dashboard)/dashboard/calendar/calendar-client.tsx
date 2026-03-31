"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Video,
  ExternalLink,
  Clock,
  Loader2,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import type { CalendarDayEvent } from "@/lib/types/event";
import { nodeEventSchema } from "@/lib/types/event";
import {
  createNodeEvent,
  updateNodeEvent,
  deleteNodeEvent,
} from "@/lib/actions/events";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EVENT_TYPE_CONFIG = {
  event: { dot: "bg-pink-400", label: "Event", color: "text-pink-400" },
  call: { dot: "bg-pink-400", label: "Call", color: "text-pink-400" },
  deadline: { dot: "bg-pink-400", label: "Deadline", color: "text-pink-400" },
  bm: { dot: "bg-white", label: "BM Official", color: "text-white" },
};

interface CalendarClientProps {
  events: CalendarDayEvent[];
  userRole: string;
}

export function CalendarClient({ events: initialEvents, userRole }: CalendarClientProps) {
  const [events, setEvents] = useState(initialEvents);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarDayEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const isSuperAdmin = userRole === "super_admin";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarDayEvent[]>();
    for (const event of events) {
      const key = event.event_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  // Calendar grid computation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { date: number; month: number; year: number; key: string; isCurrentMonth: boolean }[] = [];

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = month - 1 < 0 ? 11 : month - 1;
      const y = month - 1 < 0 ? year - 1 : year;
      days.push({
        date: d,
        month: m,
        year: y,
        key: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: d,
        month,
        year,
        key: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        isCurrentMonth: true,
      });
    }

    // Next month leading days
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month + 1 > 11 ? 0 : month + 1;
      const y = month + 1 > 11 ? year + 1 : year;
      days.push({
        date: d,
        month: m,
        year: y,
        key: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  const todayKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const prevMonth = useCallback(() => {
    setCurrentDate(new Date(year, month - 1, 1));
  }, [year, month]);

  const nextMonth = useCallback(() => {
    setCurrentDate(new Date(year, month + 1, 1));
  }, [year, month]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dayEvents = eventsByDate.get(selectedDate) ?? [];
    // NODE events first, BM events last
    return [...dayEvents].sort((a, b) => {
      if (a.event_type === "bm" && b.event_type !== "bm") return 1;
      if (a.event_type !== "bm" && b.event_type === "bm") return -1;
      return 0;
    });
  }, [selectedDate, eventsByDate]);

  const nodeSelectedEvents = selectedEvents.filter((e) => e.event_type !== "bm");
  const bmSelectedEvents = selectedEvents.filter((e) => e.event_type === "bm");

  function openCreateForm() {
    setEditingEvent(null);
    setFormOpen(true);
  }

  function openEditForm(event: CalendarDayEvent) {
    setEditingEvent(event);
    setFormOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const data = {
      title: form.get("title") as string,
      event_type: form.get("event_type") as "call" | "event" | "deadline",
      event_date: form.get("event_date") as string,
      start_time: (form.get("start_time") as string) || undefined,
      end_time: (form.get("end_time") as string) || undefined,
      join_link: (form.get("join_link") as string) || undefined,
      description: (form.get("description") as string) || undefined,
    };

    const parsed = nodeEventSchema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);

    if (editingEvent) {
      const result = await updateNodeEvent(editingEvent.id, data);
      if ("error" in result) {
        toast.error(result.error);
        setSaving(false);
        return;
      }
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === editingEvent.id
            ? {
                ...ev,
                ...data,
                start_time: data.start_time || null,
                end_time: data.end_time || null,
                join_link: data.join_link || null,
                description: data.description || null,
              }
            : ev
        )
      );
      toast.success("Event updated");
    } else {
      const result = await createNodeEvent(data);
      if ("error" in result) {
        toast.error(result.error);
        setSaving(false);
        return;
      }
      const newEvent: CalendarDayEvent = {
        id: result.id,
        title: data.title,
        event_type: data.event_type,
        event_date: data.event_date,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        join_link: data.join_link || null,
        description: data.description || null,
      };
      setEvents((prev) => [...prev, newEvent]);
      toast.success("Event created");
    }

    setSaving(false);
    setFormOpen(false);
    setEditingEvent(null);
  }

  async function handleDelete(eventId: string) {
    setDeleting(eventId);
    const result = await deleteNodeEvent(eventId);
    if ("error" in result) {
      toast.error(result.error);
      setDeleting(null);
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    toast.success("Event deleted");
    setDeleting(null);
    const remaining = events.filter(
      (e) => e.id !== eventId && e.event_date === selectedDate
    );
    if (remaining.length === 0) setSelectedDate(null);
  }

  function formatTime(time: string | null): string {
    if (!time) return "";
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }

  function formatDateLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-sand-100">Calendar</h1>
          <p className="mt-1 text-sand-400">NODE 2026 events and deadlines</p>
        </div>
        {isSuperAdmin && (
          <Button
            onClick={() => openCreateForm()}
            className="gap-2 bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 border border-pink-500/20 w-fit"
          >
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
        )}
      </motion.div>

      {/* Month Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevMonth}
            className="text-sand-300 hover:text-sand-100 hover:bg-pink-500/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold text-sand-100 min-w-[200px] text-center">
            {MONTHS[month]} {year}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextMonth}
            className="text-sand-300 hover:text-sand-100 hover:bg-pink-500/10"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
          className="border-pink-500/20 text-sand-300 hover:text-sand-100 hover:bg-pink-500/10"
        >
          Today
        </Button>
      </motion.div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-sand-400">
        {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => {
          if (key === "bm" && userRole !== "admin" && userRole !== "super_admin") return null;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${config.dot}`} />
              {config.label}
            </div>
          );
        })}
      </div>

      {/* Calendar Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl border-0 overflow-hidden"
      >
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-pink-500/10">
          {DAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-3 text-center text-xs font-medium uppercase tracking-wider text-sand-500"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dayEvents = eventsByDate.get(day.key) ?? [];
            const isToday = day.key === todayKey;
            const hasEvents = dayEvents.length > 0;
            const types = [...new Set(dayEvents.map((e) => e.event_type))];

            return (
              <button
                key={`${day.key}-${i}`}
                onClick={() => {
                  if (hasEvents || (isSuperAdmin && day.isCurrentMonth)) {
                    setSelectedDate(day.key);
                  }
                }}
                className={`
                  relative min-h-[72px] sm:min-h-[88px] border-b border-r border-pink-500/5 p-1.5 sm:p-2 text-left transition-colors
                  ${day.isCurrentMonth ? "hover:bg-pink-500/5" : "opacity-40"}
                  ${hasEvents || (isSuperAdmin && day.isCurrentMonth) ? "cursor-pointer" : "cursor-default"}
                `}
              >
                <span
                  className={`
                    inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-xs sm:text-sm
                    ${isToday
                      ? "bg-pink-500 text-white font-bold"
                      : day.isCurrentMonth
                        ? "text-sand-200"
                        : "text-sand-600"
                    }
                  `}
                >
                  {day.date}
                </span>

                {types.length > 0 && (
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {types.map((type) => (
                      <span
                        key={type}
                        className={`h-1.5 w-1.5 rounded-full ${EVENT_TYPE_CONFIG[type].dot}`}
                      />
                    ))}
                  </div>
                )}

                {/* Event titles preview (desktop only) */}
                <div className="mt-0.5 hidden sm:block space-y-0.5">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className={`truncate text-[10px] leading-tight flex items-center gap-0.5 ${EVENT_TYPE_CONFIG[event.event_type].color}`}
                    >
                      {event.event_type === "call" && <Phone className="h-2 w-2 shrink-0" />}
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[10px] text-sand-500">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Day Detail Dialog */}
      <Dialog
        open={!!selectedDate}
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null);
        }}
      >
        <DialogContent className="border-pink-500/10 max-h-[85vh] overflow-y-auto sm:max-w-lg bg-[rgba(36,3,68,0.92)] backdrop-blur-xl">
          {selectedDate && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sand-100">
                  {formatDateLabel(selectedDate)}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Events for {formatDateLabel(selectedDate)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {nodeSelectedEvents.length > 0 ? (
                  <div className="space-y-3">
                    {nodeSelectedEvents.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-xl bg-pink-500/5 border border-pink-500/10 p-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${EVENT_TYPE_CONFIG[event.event_type].dot}`}
                            />
                            {event.event_type === "call" && <Phone className="h-3.5 w-3.5 shrink-0 text-pink-400" />}
                            <h3 className="font-medium text-sand-100 text-sm truncate">
                              {event.title}
                            </h3>
                          </div>
                          <span
                            className={`shrink-0 text-xs font-medium ${EVENT_TYPE_CONFIG[event.event_type].color}`}
                          >
                            {EVENT_TYPE_CONFIG[event.event_type].label}
                          </span>
                        </div>

                        {event.description && (
                          <p className="text-sm text-sand-300">
                            {event.description}
                          </p>
                        )}

                        {(event.start_time || event.end_time) && (
                          <div className="flex items-center gap-1.5 text-xs text-sand-400">
                            <Clock className="h-3 w-3" />
                            {event.start_time && formatTime(event.start_time)}
                            {event.start_time && event.end_time && " – "}
                            {event.end_time && formatTime(event.end_time)}
                          </div>
                        )}

                        {event.join_link && (
                          <a
                            href={event.join_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/25 transition-colors"
                          >
                            <Video className="h-3 w-3" />
                            Join Call
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}

                        {isSuperAdmin && (
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditForm(event)}
                              className="h-7 gap-1.5 text-xs text-sand-400 hover:text-sand-200 hover:bg-pink-500/10"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(event.id)}
                              disabled={deleting === event.id}
                              className="h-7 gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              {deleting === event.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-sand-500">No NODE events on this date.</p>
                )}

                {bmSelectedEvents.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-pink-500/10">
                    <h4 className="text-xs font-medium uppercase tracking-wider text-sand-500">
                      Burning Man Official
                    </h4>
                    {bmSelectedEvents.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                          <span className="text-sm text-sand-400">
                            {event.title}
                          </span>
                        </div>
                        {event.description && (
                          <p className="mt-1 text-xs text-sand-500 pl-4">
                            {event.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isSuperAdmin && (
                <DialogFooter>
                  <Button
                    onClick={() => openCreateForm()}
                    className="gap-2 bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 border border-pink-500/20"
                  >
                    <Plus className="h-4 w-4" />
                    Add Event
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Event Form Dialog (super_admin only) */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditingEvent(null);
          }
        }}
      >
        <DialogContent className="border-pink-500/10 sm:max-w-md bg-[rgba(36,3,68,0.92)] backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-sand-100">
              {editingEvent ? "Edit Event" : "New Event"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingEvent ? "Edit an existing event" : "Create a new event"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sand-300">
                Title
              </Label>
              <Input
                id="title"
                name="title"
                required
                defaultValue={editingEvent?.title ?? ""}
                placeholder="e.g. NODE Town Hall"
                className="border-pink-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event_type" className="text-sand-300">
                  Type
                </Label>
                <Select
                  name="event_type"
                  defaultValue={editingEvent?.event_type ?? "event"}
                >
                  <SelectTrigger className="border-pink-500/20 text-sand-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass">
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="deadline">Deadline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event_date" className="text-sand-300">
                  Date
                </Label>
                <Input
                  id="event_date"
                  name="event_date"
                  type="date"
                  required
                  defaultValue={editingEvent?.event_date ?? selectedDate ?? ""}
                  className="border-pink-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time" className="text-sand-300">
                  Start Time
                </Label>
                <Input
                  id="start_time"
                  name="start_time"
                  type="time"
                  defaultValue={editingEvent?.start_time ?? ""}
                  className="border-pink-500/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_time" className="text-sand-300">
                  End Time
                </Label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="time"
                  defaultValue={editingEvent?.end_time ?? ""}
                  className="border-pink-500/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="join_link" className="text-sand-300">
                Join Link
              </Label>
              <Input
                id="join_link"
                name="join_link"
                type="url"
                defaultValue={editingEvent?.join_link ?? ""}
                placeholder="https://zoom.us/j/..."
                className="border-pink-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sand-300">
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={editingEvent?.description ?? ""}
                placeholder="Optional details about the event..."
                rows={3}
                className="border-pink-500/20 resize-none"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFormOpen(false);
                  setEditingEvent(null);
                }}
                className="text-sand-400 hover:text-sand-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="gap-2 bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 border border-pink-500/20"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingEvent ? "Save Changes" : "Create Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
