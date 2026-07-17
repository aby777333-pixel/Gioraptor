// GIO RAPTOR — Unified Market API: single quote
// GET /api/market/quote?symbol=EURUSD
import { NextResponse } from 'next/server';
import { getQuote } from '@/lib/market/raptor-feed';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  const q = await getQuote(symbol);
  if (!q) return NextResponse.json({ error: 'no data for symbol', symbol }, { status: 404 });
  return NextResponse.json(q, {
    headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
  });
}
