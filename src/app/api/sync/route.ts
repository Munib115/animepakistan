import { NextRequest, NextResponse } from 'next/server';
import { checkAndSyncNewAnime } from '@/lib/sync';

export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get('force') === 'true';
    const result = await checkAndSyncNewAnime(force);
    return NextResponse.json({
      success: true,
      message: result.synced > 0 ? `Synced ${result.synced} new anime!` : 'Catalog is already up to date.',
      data: result
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await checkAndSyncNewAnime(true);
    return NextResponse.json({
      success: true,
      message: `Force sync completed. Added ${result.synced} new anime.`,
      data: result
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
