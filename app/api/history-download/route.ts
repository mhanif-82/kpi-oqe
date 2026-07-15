import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const path = new URL(req.url).searchParams.get('path');
  if (!path) return NextResponse.json({ error: 'no path' }, { status: 400 });

  // Signed URL singkat + paksa download (attachment).
  const { data, error } = await sb.storage.from('uploads').createSignedUrl(path, 60, { download: true });
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'file tidak ditemukan' }, { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}
