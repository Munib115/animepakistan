import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const movie = searchParams.get('movie') || 'doraemon-undersea-devil';

  // Candidate file paths
  const candidatePaths = [
    path.join(process.cwd(), 'public', 'videos', 'doraemon-nobita-and-the-castle-of-the-undersea-devil.mp4'),
    path.join(process.cwd(), 'Doraemon New Nobita and the Castle of the Undersea Devil !.mp4'),
    path.join(process.cwd(), 'public', 'videos', `${movie}.mp4`),
  ];

  let filePath = '';
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    return new NextResponse('Video file not found', { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.get('range');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${fileSize}`,
        },
      });
    }

    const chunksize = end - start + 1;
    const nodeStream = fs.createReadStream(filePath, { start, end });

    // Convert Node ReadStream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk));
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=86400, no-transform',
      },
    });
  }

  // Full file request
  const nodeStream = fs.createReadStream(filePath);
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(chunk));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Length': fileSize.toString(),
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400, no-transform',
    },
  });
}

export async function HEAD(req: NextRequest) {
  const filePath = path.join(process.cwd(), 'public', 'videos', 'doraemon-nobita-and-the-castle-of-the-undersea-devil.mp4');
  if (!fs.existsSync(filePath)) {
    return new NextResponse(null, { status: 404 });
  }
  const stat = fs.statSync(filePath);
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Length': stat.size.toString(),
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    },
  });
}
