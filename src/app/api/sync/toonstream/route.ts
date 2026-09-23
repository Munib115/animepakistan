import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Dynamic import to prevent bundling overhead during client compilation
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { runAutoSync } = require('../../../../../scripts/auto_sync_toonstream.js');
    const result = await runAutoSync();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
      message: 'ToonStream sync completed successfully'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to sync with ToonStream'
    }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
