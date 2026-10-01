import { NextResponse } from 'next/server';
import { warmUp, isNeonEnabled } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  try {
    await warmUp();
    return NextResponse.json({ 
      ok: true, 
      neon: isNeonEnabled(),
      warmupMs: Date.now() - start 
    });
  } catch {
    return NextResponse.json({ ok: false, warmupMs: Date.now() - start });
  }
}
