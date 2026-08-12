import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const parts = publicUrl.split(`/${bucket}/`);
  if (!parts[1]) return null;
  return parts[1];
}

export async function GET(req: NextRequest) {
  try {
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
    const beatIds = [...new Set(items.map((i) => i.beat_id).filter(Boolean))];

    const { data: beats, error: beatsError } = await supabaseAdmin
      .from("beats")
      .select("id, title, full_url, stems_url")
      .in("id", beatIds);

    if (beatsError || !beats) {
      return NextResponse.json(
        { success: false, message: "Could not load files" },
        { status: 500 }
      );
    }

    const beatsById = new Map(beats.map((b) => [b.id, b]));
    const downloads: Array<{ beat_id: string; title: string; url: string; license: string }> = [];

    for (const item of items) {
      const beat = beatsById.get(item.beat_id);
      if (!beat) continue;

      // Pick the right file based on what they bought
      let fileUrl: string | null = null;
      let bucket: string = 'beats-private';

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

      const path = extractStoragePath(fileUrl, 'beats-private');
      if (!path) continue;

      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from("beats-private")
        .createSignedUrl(path, 300); // 5-minute link

      if (signError || !signed) {
        console.error(`[Download] Could not sign URL for ${path}:`, signError?.message);
        continue;
      }

      downloads.push({ 
        beat_id: beat.id, 
        title: beat.title, 
        url: signed.signedUrl,
        license: item.license
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
