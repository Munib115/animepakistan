import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'zip'; // 'zip' or 'gba'

    const fileName = format === 'gba' 
      ? 'dbz-supersonic-warriors.gba' 
      : 'dbz-supersonic-warriors.zip';
    
    const filePath = path.join(process.cwd(), 'public', 'roms', fileName);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Game ROM file not found' }, { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': format === 'gba' ? 'application/octet-stream' : 'application/zip',
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to serve ROM' }, { status: 500 });
  }
}

// Optional endpoint to sync ROM to Supabase Storage 'games' bucket
export async function POST() {
  try {
    const zipPath = path.join(process.cwd(), 'public', 'roms', 'dbz-supersonic-warriors.zip');
    if (!fs.existsSync(zipPath)) {
      return NextResponse.json({ error: 'Local ROM file not found' }, { status: 404 });
    }

    const fileData = fs.readFileSync(zipPath);
    const { data, error } = await supabase.storage
      .from('games')
      .upload('dbz-supersonic-warriors.zip', fileData, {
        contentType: 'application/zip',
        upsert: true,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { data: publicUrlData } = supabase.storage
      .from('games')
      .getPublicUrl('dbz-supersonic-warriors.zip');

    return NextResponse.json({ 
      success: true, 
      path: data.path,
      publicUrl: publicUrlData.publicUrl 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
