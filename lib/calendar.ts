import { google } from 'googleapis';
import { addMinutes, eachDayOfInterval } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const TIMEZONE = process.env.TIMEZONE || 'UTC';
const WORK_START = parseInt(process.env.WORK_HOURS_START || '9');
const WORK_END = parseInt(process.env.WORK_HOURS_END || '18');
const DURATION = parseInt(process.env.MEETING_DURATION_MINUTES || '30');

function getAuth() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error(
      'Google Calendar credentials not configured. ' +
        'Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in your .env.local file.'
    );
  }
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
}

export interface TimeSlot {
  start: string;
  end: string;
}

export async function getAvailableSlots(
  startDate: Date,
  endDate: Date
): Promise<TimeSlot[]> {
  const calendar = google.calendar({ version: 'v3', auth: getAuth() });

  const freebusyRes = await calendar.freebusy.query({
    requestBody: {
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      timeZone: TIMEZONE,
      items: [{ id: CALENDAR_ID }],
    },
  });

  const busy = freebusyRes.data.calendars?.[CALENDAR_ID]?.busy || [];
  const now = new Date();
  const slots: TimeSlot[] = [];

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  for (const day of days) {
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends

    // Build working-hours boundaries in the owner's timezone then convert to UTC
    const dateStr = day.toISOString().slice(0, 10);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dayStart = fromZonedTime(`${dateStr}T${pad(WORK_START)}:00:00`, TIMEZONE);
    const dayEnd = fromZonedTime(`${dateStr}T${pad(WORK_END)}:00:00`, TIMEZONE);

    let slotStart = new Date(dayStart);

    while (addMinutes(slotStart, DURATION) <= dayEnd) {
      const slotEnd = addMinutes(slotStart, DURATION);

      // Require at least 30 min lead time
      if (slotStart > addMinutes(now, 30)) {
        const overlaps = busy.some((b) => {
          if (!b.start || !b.end) return false;
          return slotStart < new Date(b.end) && slotEnd > new Date(b.start);
        });

        if (!overlaps) {
          slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
        }
      }

      slotStart = slotEnd;
    }
  }

  return slots;
}

export async function createMeeting(params: {
  name: string;
  email: string;
  company: string;
  start: string;
  end: string;
}) {
  const calendar = google.calendar({ version: 'v3', auth: getAuth() });

  const attendees: { email: string; displayName?: string }[] = [
    { email: params.email, displayName: params.name },
  ];
  if (process.env.OWNER_EMAIL) {
    attendees.push({
      email: process.env.OWNER_EMAIL,
      displayName: process.env.NEXT_PUBLIC_OWNER_NAME || 'Host',
    });
  }

  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    sendUpdates: 'all',
    conferenceDataVersion: 1,
    requestBody: {
      summary: `Meeting with ${params.name} (${params.company})`,
      description: [
        `Name: ${params.name}`,
        `Email: ${params.email}`,
        `Company: ${params.company}`,
        '',
        'Booked via the online scheduling page.',
      ].join('\n'),
      start: { dateTime: params.start, timeZone: TIMEZONE },
      end: { dateTime: params.end, timeZone: TIMEZONE },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `scheduler-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  const meetLink =
    res.data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')
      ?.uri ?? null;

  return { event: res.data, meetLink };
}
