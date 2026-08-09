type SupabaseMethod = "GET" | "POST" | "PATCH" | "DELETE";

type SupabaseOptions = {
  method?: SupabaseMethod;
  body?: unknown;
  prefer?: string;
};

export type StoredWish = {
  id: string;
  device_id: string;
  external_id: string;
  query: string;
  title: string;
  initial_price: number;
  current_price: number;
  source: string;
  link: string;
  thumbnail: string;
  rating: number | null;
  reviews: number | null;
  delivery: string;
  match_score: number;
  retailer_score: number;
  price_score: number;
  want_score: number;
  reasons: string[];
  badges: string[];
  possible_mismatch: boolean;
  trusted_seller: boolean;
  price_confidence: "normal" | "low" | "high";
  created_at: string;
  last_checked_at: string;
};

export type StoredPricePoint = {
  wish_id: string;
  price: number;
  checked_at: string;
};

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables are not configured");
  }

  return {
    url,
    serviceKey,
  };
}

export async function supabaseRequest<T>(
  path: string,
  options: SupabaseOptions = {}
) {
  const { url, serviceKey } = getSupabaseConfig();

  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(message || `Supabase returned ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();

  if (!text) {
    return null as T;
  }

  return JSON.parse(text) as T;
}

export function toClientWish(
  wish: StoredWish,
  history: StoredPricePoint[] = []
) {
  return {
    id: wish.external_id,
    wishId: wish.id,
    query: wish.query,
    title: wish.title,
    price: wish.current_price,
    source: wish.source,
    link: wish.link,
    thumbnail: wish.thumbnail,
    rating: wish.rating,
    reviews: wish.reviews,
    delivery: wish.delivery,
    matchScore: wish.match_score,
    retailerScore: wish.retailer_score,
    priceScore: wish.price_score,
    wantScore: wish.want_score,
    reasons: wish.reasons || [],
    badges: wish.badges || [],
    possibleMismatch: wish.possible_mismatch,
    trustedSeller: wish.trusted_seller,
    priceConfidence: wish.price_confidence,
    addedAt: wish.created_at,
    lastCheckedAt: wish.last_checked_at,
    initialPrice: wish.initial_price,
    currentPrice: wish.current_price,
    priceHistory:
      history.length > 0
        ? history.map((point) => ({
            date: point.checked_at,
            price: point.price,
          }))
        : [
            {
              date: wish.created_at,
              price: wish.initial_price,
            },
          ],
  };
}
