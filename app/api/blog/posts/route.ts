import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireUploaderInfo } from '@/lib/auth-server';
import { rateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

// Blog posts — mainly album reviews, scored out of 10.
//
// POST   creates a post
// PATCH  updates one (pass `id`)
//
// Both take multipart form data because a post can carry cover artwork.

const ALLOWED_IMAGES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMAGE = 5 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_{2,}/g, '_');
}

// "Burna Boy — Love, Damini" -> "burna-boy-love-damini"
// Must match the CHECK constraint on posts.slug: ^[a-z0-9]+(-[a-z0-9]+)*$
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function uploadCover(cover: File): Promise<string> {
  const path = `blog-covers/${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(cover.name)}`;
  const { error } = await supabaseAdmin.storage
    .from('beats-public')
    .upload(path, cover, { contentType: cover.type, upsert: false });
  if (error) throw error;
  const { data } = supabaseAdmin.storage.from('beats-public').getPublicUrl(path);
  return data.publicUrl;
}

// Shared field parsing + validation for create and update.
function readFields(formData: FormData) {
  const title = String(formData.get('title') || '').trim();
  const body = String(formData.get('body') || '').trim();
  const albumArtist = String(formData.get('album_artist') || '').trim();
  const albumTitle = String(formData.get('album_title') || '').trim();
  const standoutTrack = String(formData.get('standout_track') || '').trim();
  const standoutProducer = String(formData.get('standout_producer') || '').trim();
  const ratingRaw = String(formData.get('rating') || '').trim();
  const published = String(formData.get('published') || 'false') === 'true';

  if (title.length > 200) return { error: 'Title is too long (200 max)' };
  if (albumArtist.length > 200 || albumTitle.length > 200) {
    return { error: 'Artist or album name is too long' };
  }
  if (standoutTrack.length > 200 || standoutProducer.length > 200) {
    return { error: 'Standout track or producer name is too long' };
  }

  // Rating is optional — a post can be a plain article rather than a review.
  let rating: number | null = null;
  if (ratingRaw !== '') {
    rating = Number(ratingRaw);
    if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
      return { error: 'Rating must be between 0 and 10' };
    }
    // One decimal place — the column is numeric(3,1), so 8.55 would be
    // rounded silently by Postgres. Round here so what you typed is what
    // you see rather than a surprise on reload.
    rating = Math.round(rating * 10) / 10;
  }

  return { title, body, albumArtist, albumTitle, standoutTrack, standoutProducer, rating, published };
}

export async function POST(req: NextRequest) {
  const uploader = await requireUploaderInfo(req);
  if (!uploader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`blog-post:${uploader.email}`, 40, 60 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  try {
    const formData = await req.formData();
    const fields = readFields(formData);
    if ('error' in fields) return NextResponse.json({ error: fields.error }, { status: 400 });
    const { title, body, albumArtist, albumTitle, standoutTrack, standoutProducer, rating, published } = fields;

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    // Slug can be supplied, otherwise derived from the title.
    const supplied = String(formData.get('slug') || '').trim();
    const slug = slugify(supplied || title);
    if (!slug) {
      return NextResponse.json({ error: 'Could not build a URL from that title' }, { status: 400 });
    }

    const cover = formData.get('cover') as File | null;
    let coverUrl: string | null = null;
    if (cover && cover.size > 0) {
      if (!ALLOWED_IMAGES.includes(cover.type) || cover.size > MAX_IMAGE) {
        return NextResponse.json(
          { error: `Invalid cover (JPG/PNG/WEBP, under 5MB). Got: ${cover.type}` },
          { status: 400 }
        );
      }
      coverUrl = await uploadCover(cover);
    }

    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert({
        author: uploader.producer,
        slug,
        title,
        album_artist: albumArtist || null,
        album_title: albumTitle || null,
        standout_track: standoutTrack || null,
        standout_producer: standoutProducer || null,
        cover_art: coverUrl,
        body,
        rating,
        published,
      })
      .select()
      .single();

    // 23505 = the slug is taken. Normal user situation, not a server fault.
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: `The URL "${slug}" is already used by another post. Change the title or set a different URL.` },
        { status: 409 }
      );
    }
    if (error) throw error;

    return NextResponse.json({ success: true, post: data });
  } catch (err: any) {
    console.error('[Blog] Create error:', err.message);
    return NextResponse.json({ error: err.message || 'Could not save the post' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const uploader = await requireUploaderInfo(req);
  if (!uploader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const id = String(formData.get('id') || '');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    // You may only edit your own posts.
    const { data: existing, error: findErr } = await supabaseAdmin
      .from('posts').select('id, author').eq('id', id).single();
    if (findErr || !existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (existing.author !== uploader.producer) {
      return NextResponse.json({ error: 'That post belongs to another producer' }, { status: 403 });
    }

    const fields = readFields(formData);
    if ('error' in fields) return NextResponse.json({ error: fields.error }, { status: 400 });
    const { title, body, albumArtist, albumTitle, standoutTrack, standoutProducer, rating, published } = fields;

    const updates: Record<string, any> = {
      title,
      body,
      album_artist: albumArtist || null,
      album_title: albumTitle || null,
      standout_track: standoutTrack || null,
      standout_producer: standoutProducer || null,
      rating,
      published,
      updated_at: new Date().toISOString(),
    };

    const suppliedSlug = String(formData.get('slug') || '').trim();
    if (suppliedSlug) updates.slug = slugify(suppliedSlug);

    const cover = formData.get('cover') as File | null;
    if (cover && cover.size > 0) {
      if (!ALLOWED_IMAGES.includes(cover.type) || cover.size > MAX_IMAGE) {
        return NextResponse.json(
          { error: `Invalid cover (JPG/PNG/WEBP, under 5MB). Got: ${cover.type}` },
          { status: 400 }
        );
      }
      updates.cover_art = await uploadCover(cover);
    }

    const { data, error } = await supabaseAdmin
      .from('posts').update(updates).eq('id', id).select().single();

    if (error?.code === '23505') {
      return NextResponse.json({ error: 'That URL is already used by another post.' }, { status: 409 });
    }
    if (error) throw error;

    return NextResponse.json({ success: true, post: data });
  } catch (err: any) {
    console.error('[Blog] Update error:', err.message);
    return NextResponse.json({ error: err.message || 'Could not update the post' }, { status: 500 });
  }
}
