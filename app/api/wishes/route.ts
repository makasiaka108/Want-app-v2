import { NextRequest, NextResponse } from "next/server";
import {
  StoredPricePoint,
  StoredWish,
  supabaseRequest,
  toClientWish,
} from "./supabase";

type IncomingDeal = {
  id: string;
  title: string;
  price: number;
  source: string;
  link: string;
  thumbnail: string;
  rating: number | null;
  reviews: number | null;
  delivery: string;
  matchScore: number;
  retailerScore: number;
  priceScore: number;
  wantScore: number;
  reasons: string[];
  badges: string[];
  possibleMismatch: boolean;
  trustedSeller: boolean;
  priceConfidence: "normal" | "low" | "high";
};

function cleanDeviceId(value: string | null) {
  return value?.trim().slice(0, 120) || "";
}

function encodeFilter(value: string) {
  return encodeURIComponent(value);
}

async function getHistory(wishes: StoredWish[]) {
  if (wishes.length === 0) return new Map<string, StoredPricePoint[]>();

  const ids = wishes.map((wish) => wish.id).join(",");

  const points = await supabaseRequest<StoredPricePoint[]>(
    `price_history?wish_id=in.(${ids})&select=wish_id,price,checked_at&order=checked_at.asc`
  );

  return points.reduce((map, point) => {
    const existing = map.get(point.wish_id) || [];

    map.set(point.wish_id, [...existing, point]);

    return map;
  }, new Map<string, StoredPricePoint[]>());
}

export async function GET(request: NextRequest) {
  try {
    const deviceId = cleanDeviceId(
      request.nextUrl.searchParams.get("deviceId")
    );

    if (!deviceId) {
      return NextResponse.json(
        {
          error: "Device id is required",
        },
        {
          status: 400,
        }
      );
    }

    const wishes = await supabaseRequest<StoredWish[]>(
      `wishes?device_id=eq.${encodeFilter(
        deviceId
      )}&select=*&order=created_at.desc`
    );

    const history = await getHistory(wishes);

    return NextResponse.json({
      wishes: wishes.map((wish) =>
        toClientWish(wish, history.get(wish.id) || [])
      ),
    });
  } catch (error) {
    console.error("WANT wishes GET error:", error);

    return NextResponse.json(
      {
        error: "Failed to load wishes",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const deviceId = cleanDeviceId(body?.deviceId || "");
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const deal = body?.deal as IncomingDeal | undefined;

    if (!deviceId || !query || !deal?.id || !deal?.title) {
      return NextResponse.json(
        {
          error: "Wish payload is incomplete",
        },
        {
          status: 400,
        }
      );
    }

    const now = new Date().toISOString();

    const payload = {
      device_id: deviceId,
      external_id: deal.id,
      query,
      title: deal.title,
      initial_price: deal.price,
      current_price: deal.price,
      source: deal.source || "Unknown store",
      link: deal.link || "",
      thumbnail: deal.thumbnail || "",
      rating: deal.rating,
      reviews: deal.reviews,
      delivery: deal.delivery || "",
      match_score: deal.matchScore,
      retailer_score: deal.retailerScore,
      price_score: deal.priceScore,
      want_score: deal.wantScore,
      reasons: deal.reasons || [],
      badges: deal.badges || [],
      possible_mismatch: Boolean(deal.possibleMismatch),
      trusted_seller: Boolean(deal.trustedSeller),
      price_confidence: deal.priceConfidence || "normal",
      last_checked_at: now,
    };

    const wishes = await supabaseRequest<StoredWish[]>(
      "wishes?on_conflict=device_id,external_id",
      {
        method: "POST",
        body: [payload],
        prefer: "resolution=merge-duplicates,return=representation",
      }
    );

    const wish = wishes[0];

    if (!wish) {
      throw new Error("Supabase did not return a saved wish");
    }

    await supabaseRequest("price_history", {
      method: "POST",
      body: [
        {
          wish_id: wish.id,
          price: deal.price,
          source: deal.source || "Unknown store",
          checked_at: now,
        },
      ],
    });

    return NextResponse.json({
      wish: toClientWish(wish, [
        {
          wish_id: wish.id,
          price: deal.price,
          checked_at: now,
        },
      ]),
    });
  } catch (error) {
    console.error("WANT wishes POST error:", error);

    return NextResponse.json(
      {
        error: "Failed to save wish",
      },
      {
        status: 500,
      }
    );
  }
}
