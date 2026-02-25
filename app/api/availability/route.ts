import { NextRequest, NextResponse } from 'next/server';
import { addDays } from 'date-fns';
import { getAvailableSlots } from '@/lib/calendar';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const start = startParam ? new Date(startParam) : new Date();
    const end = endParam ? new Date(endParam) : addDays(new Date(), 30);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date parameters' }, { status: 400 });
    }

    const slots = await getAvailableSlots(start, end);
    return NextResponse.json({ slots });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch availability';
    console.error('[availability]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
