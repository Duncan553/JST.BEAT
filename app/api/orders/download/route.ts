import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/rate-limit";

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const parts = publicUrl.split(`/${bucket}/`);
  if (!parts[1]) return null;
  return parts[1];
}

export async function GET(req: NextRequest) {
  try {
    // The only thing gating this route is knowledge of `reference` — and
    // it's a timestamp + a 3-digit random number, not a real secret. Rate
    // limiting doesn't fix that, but it does kill casual brute-forcing.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const limit = rateLimit(`download:${ip}`, 20, 60 * 1000);
    if (!limit.success) {
      return NextResponse.json({ success: false, message: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const reference = searchParams.get("reference");

    if (!reference) {
      return NextResponse.json(
        { success: false, message: "Reference is required" },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("status, items")
      .eq("reference", reference)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    if (order.status !== "paid") {
      return NextResponse.json(
        { success: false, message: "Order is not paid yet" },
        { status: 403 }
      );
    }

    const items = (order.items as any[]) || [];

    // An order can mix beats and store releases. They live in different
    // tables and a release fans out into one file per track, so they're
    // resolved separately.
    const beatItems = items.filter((i) => i.kind !== 'release');
    const releaseItems = items.filter((i) => i.kind === 'release');

    const beatIds = [...new Set(beatItems.map((i) => i.beat_id).filter(Boolean))];
    const releaseIds = [...new Set(releaseItems.map((i) => i.beat_id).filter(Boolean))];

    const { data: beats, error: beatsError } = beatIds.length
      ? await supabaseAdmin.from("beats").select("id, title, full_url, stems_url").in("id", beatIds)
      : { data: [], error: null };

    if (beatsError || !beats) {
      return NextResponse.json(
        { success: false, message: "Could not load files" },
        { status: 500 }
      );
    }

    const beatsById = new Map(beats.map((b) => [b.id, b]));
    const downloads: Array<{ beat_id: string; title: string; url: string; license: string }> = [];

    // Signs a private-bucket URL. Returns null and logs rather than throwing,
    // so one broken file can't cost the buyer the rest of their order.
    const signPrivate = async (fileUrl: string | null): Promise<string | null> => {
      if (!fileUrl) return null;
      const path = extractStoragePath(fileUrl, 'beats-private');
      if (!path) return null;
      const { data: signed, error } = await supabaseAdmin.storage
        .from("beats-private")
        .createSignedUrl(path, 300); // 5-minute link
      if (error || !signed) {
        console.error(`[Download] Could not sign ${path}:`, error?.message);
        return null;
      }
      return signed.signedUrl;
    };

    // --- store releases: every track of a paid release ---
    if (releaseIds.length) {
      const { data: releases } = await supabaseAdmin
        .from("releases")
        .select("id, title, tracks(title, track_number, full_url)")
        .in("id", releaseIds);

      for (const release of releases || []) {
        const tracks = [...((release as any).tracks || [])].sort(
          (a: any, b: any) => a.track_number - b.track_number
        );
        for (const track of tracks) {
          const url = await signPrivate(track.full_url);
          if (!url) continue;
          downloads.push({
            beat_id: release.id,
            title: `${release.title} — ${String(track.track_number).padStart(2, '0')}. ${track.title}`,
            url,
            license: 'release',
          });
        }
      }
    }

    // --- beats ---
    for (const item of beatItems) {
      const beat = beatsById.get(item.beat_id);
      if (!beat) continue;

      // Pick the right file based on what they bought
      let fileUrl: string | null = null;

      if (item.license === 'stems') {
        fileUrl = beat.stems_url || null;
      } else {
        // Default to WAV (full beat)
        fileUrl = beat.full_url || null;
      }

      if (!fileUrl) {
        console.error(`[Download] Missing file for ${item.license}: beat ${beat.id}`);
        continue;
      }

      const url = await signPrivate(fileUrl);
      if (!url) continue;

      downloads.push({
        beat_id: beat.id,
        title: beat.title,
        url,
        license: item.license,
      });
    }

    return NextResponse.json({ success: true, downloads });
  } catch (error: any) {
    console.error("[API] Download error:", error.message);
    return NextResponse.json(
      { success: false, message: "Failed to prepare downloads" },
      { status: 500 }
    );
  }
}
