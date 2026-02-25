'use client';

import { useState, useEffect } from 'react';
import {
  format,
  addDays,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
  isBefore,
  startOfToday,
  isWeekend,
} from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeSlot {
  start: string;
  end: string;
}

type Step = 'pick' | 'info' | 'done';

// ─── Constants ────────────────────────────────────────────────────────────────

const OWNER_NAME = process.env.NEXT_PUBLIC_OWNER_NAME || 'Schedule a Meeting';
const OWNER_TITLE = process.env.NEXT_PUBLIC_OWNER_TITLE || '';
const DURATION = parseInt(process.env.NEXT_PUBLIC_MEETING_DURATION_MINUTES || '30');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookingPage() {
  // Availability state
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Calendar navigation
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Selection state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Multi-step flow
  const [step, setStep] = useState<Step>('pick');

  // Form state
  const [form, setForm] = useState({ name: '', email: '', company: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Confirmation state
  const [bookedSlot, setBookedSlot] = useState<TimeSlot | null>(null);
  const [meetLink, setMeetLink] = useState<string | null>(null);

  // Timezone label (client-side only to avoid hydration mismatch)
  const [tz, setTz] = useState('');
  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  // ── Fetch availability ───────────────────────────────────────────────────

  useEffect(() => {
    loadSlots();
  }, []);

  async function loadSlots() {
    setLoading(true);
    setFetchError(null);
    try {
      const start = new Date().toISOString();
      const end = addDays(new Date(), 30).toISOString();
      const res = await fetch(`/api/availability?start=${start}&end=${end}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setSlots(data.slots ?? []);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const availableDateSet = new Set(
    slots.map((s) => format(new Date(s.start), 'yyyy-MM-dd'))
  );

  const slotsForDate = selectedDate
    ? slots.filter((s) => isSameDay(new Date(s.start), selectedDate))
    : [];

  const today = startOfToday();
  const maxDate = addDays(today, 30);

  function isDaySelectable(day: Date) {
    return (
      !isBefore(day, today) &&
      !isBefore(maxDate, day) &&
      !isWeekend(day) &&
      availableDateSet.has(format(day, 'yyyy-MM-dd'))
    );
  }

  // ── Calendar grid ────────────────────────────────────────────────────────

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart); // blank cells before day 1

  const canGoPrev = !isBefore(subMonths(currentMonth, 1), startOfMonth(today));

  // ── Form validation ──────────────────────────────────────────────────────

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = 'Enter a valid email address';
    if (!form.company.trim()) errors.company = 'Company is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Submit booking ───────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !selectedSlot) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company,
          start: selectedSlot.start,
          end: selectedSlot.end,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      setBookedSlot(selectedSlot);
      setMeetLink(data.meetLink ?? null);
      setStep('done');
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-8 text-white">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-2xl font-bold shrink-0">
                {OWNER_NAME.split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest mb-1">
                  Book a meeting with
                </p>
                <h1 className="text-2xl font-bold leading-tight">{OWNER_NAME}</h1>
                {OWNER_TITLE && (
                  <p className="text-indigo-200 text-sm mt-0.5">{OWNER_TITLE}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-indigo-100">
                  <span className="flex items-center gap-1.5">
                    <ClockIcon /> {DURATION} min
                  </span>
                  <span className="flex items-center gap-1.5">
                    <VideoIcon /> Google Meet
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <LoadingState />
          ) : fetchError ? (
            <ErrorState message={fetchError} onRetry={loadSlots} />
          ) : step === 'pick' ? (
            /* ── Step 1: pick date & time ── */
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
              {/* Calendar */}
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-base font-semibold text-gray-900">
                    {format(currentMonth, 'MMMM yyyy')}
                  </h2>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                      disabled={!canGoPrev}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition"
                      aria-label="Previous month"
                    >
                      <ChevronLeft />
                    </button>
                    <button
                      onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                      className="p-2 rounded-lg hover:bg-gray-100 transition"
                      aria-label="Next month"
                    >
                      <ChevronRight />
                    </button>
                  </div>
                </div>

                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAYS.map((d) => (
                    <div
                      key={d}
                      className="text-center text-xs font-medium text-gray-400 py-1"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: startPad }).map((_, i) => (
                    <div key={`pad-${i}`} />
                  ))}
                  {daysInMonth.map((day) => {
                    const selectable = isDaySelectable(day);
                    const selected = selectedDate ? isSameDay(day, selectedDate) : false;
                    const past = isBefore(day, today);

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => {
                          if (!selectable) return;
                          setSelectedDate(day);
                          setSelectedSlot(null);
                        }}
                        disabled={!selectable}
                        className={[
                          'aspect-square rounded-xl text-sm font-medium transition-all',
                          selected
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                            : selectable
                            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer'
                            : past
                            ? 'text-gray-200 cursor-not-allowed'
                            : 'text-gray-300 cursor-not-allowed',
                          isToday(day) && !selected
                            ? 'ring-2 ring-indigo-400 ring-offset-1'
                            : '',
                        ]
                          .join(' ')
                          .trim()}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              <div className="p-8">
                {!selectedDate ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                      <CalendarBigIcon />
                    </div>
                    <p className="text-gray-500 text-sm">
                      Select a date to see available times
                    </p>
                  </div>
                ) : (
                  <>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      {format(selectedDate, 'EEEE, MMMM d')}
                    </h3>
                    <p className="text-xs text-gray-400 mb-5">
                      {slotsForDate.length === 0
                        ? 'No slots available'
                        : `${slotsForDate.length} slot${slotsForDate.length !== 1 ? 's' : ''} available`}
                    </p>

                    {slotsForDate.length === 0 ? (
                      <p className="text-center text-gray-400 py-10 text-sm">
                        No available slots on this date
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {slotsForDate.map((slot) => (
                          <button
                            key={slot.start}
                            onClick={() => {
                              setSelectedSlot(slot);
                              setStep('info');
                            }}
                            className="w-full py-3 px-4 rounded-xl border-2 border-indigo-200 text-indigo-700 font-medium text-sm hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all"
                          >
                            {format(new Date(slot.start), 'h:mm a')} –{' '}
                            {format(new Date(slot.end), 'h:mm a')}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : step === 'info' ? (
            /* ── Step 2: enter details ── */
            <div className="p-8 max-w-lg mx-auto">
              <button
                onClick={() => {
                  setStep('pick');
                  setSelectedSlot(null);
                  setSubmitError(null);
                  setFormErrors({});
                }}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 mb-8 transition"
              >
                <ChevronLeft /> Back
              </button>

              {/* Selected slot summary */}
              {selectedSlot && selectedDate && (
                <div className="bg-indigo-50 rounded-2xl p-4 mb-8">
                  <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-2">
                    Your selected time
                  </p>
                  <p className="font-semibold text-gray-900">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-indigo-700 text-sm mt-0.5">
                    {format(new Date(selectedSlot.start), 'h:mm a')} –{' '}
                    {format(new Date(selectedSlot.end), 'h:mm a')}
                    {tz && (
                      <span className="text-gray-400 ml-1.5">({tz})</span>
                    )}
                  </p>
                </div>
              )}

              <h2 className="text-xl font-bold text-gray-900 mb-6">Your Information</h2>

              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 mb-5 text-sm">
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* Name */}
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={form.name}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, name: e.target.value }));
                      setFormErrors((fe) => ({ ...fe, name: '' }));
                    }}
                    placeholder="Jane Doe"
                    className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition ${
                      formErrors.name ? 'border-red-400 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, email: e.target.value }));
                      setFormErrors((fe) => ({ ...fe, email: '' }));
                    }}
                    placeholder="jane@acme.com"
                    className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition ${
                      formErrors.email ? 'border-red-400 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {formErrors.email && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
                  )}
                </div>

                {/* Company */}
                <div>
                  <label
                    htmlFor="company"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Company <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="company"
                    type="text"
                    value={form.company}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, company: e.target.value }));
                      setFormErrors((fe) => ({ ...fe, company: '' }));
                    }}
                    placeholder="Acme Inc."
                    className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition ${
                      formErrors.company ? 'border-red-400 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {formErrors.company && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.company}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-lg shadow-indigo-100 mt-2"
                >
                  {submitting ? 'Confirming…' : 'Confirm Meeting →'}
                </button>
              </form>
            </div>
          ) : (
            /* ── Step 3: confirmation ── */
            <div className="py-16 px-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckIcon />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">You&apos;re booked!</h2>
              <p className="text-gray-500 mb-10">
                A calendar invite has been sent to{' '}
                <span className="font-medium text-gray-700">{form.email}</span>
              </p>

              {bookedSlot && (
                <div className="bg-gray-50 rounded-2xl p-6 max-w-sm mx-auto text-left space-y-4 mb-8">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Meeting Details
                  </p>

                  {/* Date & time */}
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                      <CalendarSmIcon />
                    </span>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(bookedSlot.start), 'h:mm a')} –{' '}
                        {format(new Date(bookedSlot.end), 'h:mm a')}
                        {tz && <span className="ml-1">({tz})</span>}
                      </p>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                      <ClockSmIcon />
                    </span>
                    <p className="text-sm text-gray-700">{DURATION} minute meeting</p>
                  </div>

                  {/* Meet link */}
                  {meetLink && (
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                        <VideoSmIcon />
                      </span>
                      <a
                        href={meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:underline font-medium"
                      >
                        Join with Google Meet
                      </a>
                    </div>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-400">We look forward to speaking with you!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {tz && (
          <p className="text-center text-xs text-gray-400 mt-4">
            All times shown in your local timezone ({tz})
          </p>
        )}
      </div>
    </div>
  );
}

// ─── SVG Icon Components ───────────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CalendarBigIcon() {
  return (
    <svg
      className="w-7 h-7 text-indigo-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function CalendarSmIcon() {
  return (
    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function ClockSmIcon() {
  return (
    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function VideoSmIcon() {
  return (
    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-gray-400 text-sm">Loading availability…</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 px-8 text-center">
      <p className="text-red-500 text-sm">{message}</p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition"
      >
        Try Again
      </button>
    </div>
  );
}
