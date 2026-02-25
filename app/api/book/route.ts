import { NextRequest, NextResponse } from 'next/server';
import { createMeeting } from '@/lib/calendar';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, company, start, end } = body as Record<string, string>;

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !company?.trim() || !start || !end) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const startDate = new Date(start);
    if (isNaN(startDate.getTime()) || startDate <= new Date()) {
      return NextResponse.json(
        { error: 'Invalid or past start time' },
        { status: 400 }
      );
    }

    const { event, meetLink } = await createMeeting({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company.trim(),
      start,
      end,
    });

    return NextResponse.json({ success: true, eventId: event.id, meetLink });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Booking failed';
    console.error('[book]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
