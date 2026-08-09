import { NextRequest, NextResponse } from "next/server";

type ShoppingProduct = {
  title?: string;
  price?: string;
  extracted_price?: number;
  source?: string;
  link?: string;
  product_link?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  delivery?: string;
  tag?: string;
  second_hand_condition?: string;
};

type Deal = {
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

type Candidate = {
  index: number;
  title: string;
  price: number;
  source: string;
  link: string;
  thumbnail: string;
  rating: number | null;
  reviews: number | null;
  delivery: string;
  matchScore: number;
  possibleMismatch: boolean;
  accessory: boolean;
  used: boolean;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPrice(product: ShoppingProduct) {
  if (
    typeof product.extracted_price === "number" &&
    Number.isFinite(product.extracted_price)
  ) {
    return product.extracted_price;
  }

  if (!product.price) return null;

  const cleaned = product.price
    .replace(/[^\d,.]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const value = Number.parseFloat(cleaned);

  return Number.isFinite(value) ? value : null;
}

function getLink(product: ShoppingProduct) {
  return product.product_link || product.link || "";
}

function getProductWords(query: string) {
  const ignored = new Set([
    "the",
    "and",
    "with",
    "for",
    "new",
    "original",
    "genuine",
    "buy",
    "find",
    "want",
    "хочу",
    "найди",
  ]);

  return normalize(query)
    .split(" ")
    .filter((word) => word.length > 1 && !ignored.has(word));
}

function analyzeMatch(query: string, title: string) {
  const words = getProductWords(query);
  const normalizedTitle = normalize(title);

  if (!words.length) {
    return {
      matchScore: 0,
      possibleMismatch: true,
    };
  }

  const matchedWords = words.filter((word) => normalizedTitle.includes(word));
  const missingWords = words.filter((word) => !normalizedTitle.includes(word));
  const numericWords = words.filter((word) => /\d/.test(word));
  const missingNumericWord = numericWords.some(
    (word) => !normalizedTitle.includes(word)
  );
  const matchScore = matchedWords.length / words.length;

  return {
    matchScore,
    possibleMismatch:
      missingNumericWord || matchScore < 0.82 || missingWords.length > 1,
  };
}

function includesAny(text: string, words: string[]) {
  const normalizedText = normalize(text);

  return words.some((word) => normalizedText.includes(normalize(word)));
}

function isAccessory(title: string) {
  return includesAny(title, [
    "case",
    "cover",
    "capa",
    "estojo",
    "protector",
    "protetor",
    "replacement",
    "ear tips",
    "ear tip",
    "strap",
    "keychain",
    "skin",
    "charger",
    "charging cable",
    "cable",
    "cabo",
    "adapter",
    "adaptador",
    "holder",
    "suporte",
    "dock",
    "stand",
    "cleaning kit",
  ]);
}

function isUsed(product: ShoppingProduct) {
  const text = [product.title, product.tag, product.second_hand_condition]
    .filter(Boolean)
    .join(" ");

  return includesAny(text, [
    "used",
    "second hand",
    "pre owned",
    "preowned",
    "refurbished",
    "renewed",
    "reconditioned",
    "recondicionado",
    "usado",
    "usados",
  ]);
}

function retailerScore(source: string) {
  const name = normalize(source);

  const tier1 = [
    "amazon",
    "fnac",
    "worten",
    "apple",
    "mediamarkt",
    "media markt",
    "el corte ingles",
    "pc componentes",
    "pccomponentes",
    "radio popular",
  ];

  const tier2 = [
    "onbuy",
    "ebay",
    "kuantokusta",
    "castro electronica",
    "globaldata",
    "pc diga",
    "pcdiga",
    "csmobiles",
  ];

  if (tier1.some((store) => name.includes(normalize(store)))) return 100;
  if (tier2.some((store) => name.includes(normalize(store)))) return 78;

  return 58;
}

function median(values: number[]) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function priceScore(price: number, marketMedian: number | null) {
  if (!marketMedian || marketMedian <= 0) return 70;

  const ratio = price / marketMedian;

  if (ratio < 0.55) return 42;
  if (ratio < 0.72) return 78;
  if (ratio < 0.9) return 100;
  if (ratio <= 1) return 92;
  if (ratio <= 1.1) return 82;
  if (ratio <= 1.25) return 66;
  if (ratio <= 1.5) return 48;

  return 30;
}

function priceConfidence(
  price: number,
  marketMedian: number | null
): Deal["priceConfidence"] {
  if (!marketMedian || marketMedian <= 0) return "normal";

  const ratio = price / marketMedian;

  if (ratio < 0.55) return "low";
  if (ratio > 1.6) return "high";

  return "normal";
}

function buildReasons(candidate: Candidate, retailer: number, price: number) {
  const reasons: string[] = [];

  if (candidate.matchScore >= 0.99) reasons.push("Exact product match");
  else if (candidate.matchScore >= 0.86) reasons.push("Strong product match");
  else reasons.push("Relevant, check model");

  if (retailer >= 95) reasons.push("Trusted seller");
  else if (retailer >= 75) reasons.push("Established marketplace");

  if (price >= 92) reasons.push("Strong price");
  else if (price >= 78) reasons.push("Competitive price");

  if (candidate.rating && candidate.rating >= 4.5) {
    reasons.push("Highly rated offer");
  }

  return reasons.slice(0, 3);
}

function makeDeal(
  candidate: Candidate,
  marketMedian: number | null,
  lowestReliablePrice: number | null
): Deal {
  const retailer = retailerScore(candidate.source);
  const pScore = priceScore(candidate.price, marketMedian);
  const confidence = priceConfidence(candidate.price, marketMedian);

  const ratingScore =
    typeof candidate.rating === "number"
      ? Math.min(100, (candidate.rating / 5) * 100)
      : 62;

  const reviewScore = candidate.reviews
    ? Math.min(100, Math.log10(candidate.reviews + 1) * 25)
    : 50;

  let score = Math.round(
    candidate.matchScore * 100 * 0.42 +
      retailer * 0.24 +
      pScore * 0.22 +
      ratingScore * 0.07 +
      reviewScore * 0.05
  );

  if (candidate.possibleMismatch) score -= 18;
  if (confidence === "low") score -= 14;
  if (confidence === "high") score -= 8;

  score = Math.max(1, Math.min(99, score));

  const badges: string[] = [];

  if (lowestReliablePrice !== null && candidate.price === lowestReliablePrice) {
    badges.push("LOWEST PRICE");
  }

  if (retailer >= 95) badges.push("TRUSTED SELLER");

  if (candidate.possibleMismatch || confidence === "low") {
    badges.push("POSSIBLE MISMATCH");
  }

  return {
    id: `${candidate.index}-${candidate.title}-${candidate.source}`,
    title: candidate.title,
    price: candidate.price,
    source: candidate.source,
    link: candidate.link,
    thumbnail: candidate.thumbnail,
    rating: candidate.rating,
    reviews: candidate.reviews,
    delivery: candidate.delivery,
    matchScore: Number(candidate.matchScore.toFixed(2)),
    retailerScore: retailer,
    priceScore: pScore,
    wantScore: score,
    reasons: buildReasons(candidate, retailer, pScore),
    badges,
    possibleMismatch: candidate.possibleMismatch || confidence === "low",
    trustedSeller: retailer >= 95,
    priceConfidence: confidence,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.SERPAPI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "SERPAPI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      engine: "google_shopping",
      q: query,
      api_key: apiKey,
      hl: "en",
      gl: "pt",
      num: "40",
    });

    const response = await fetch(
      `https://serpapi.com/search.json?${params.toString()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`SerpAPI returned ${response.status}`);
    }

    const data = await response.json();
    const rawProducts: ShoppingProduct[] = data.shopping_results ?? [];

    const candidates: Candidate[] = rawProducts
      .map((product, index) => {
        const title = product.title || "Unknown product";
        const price = getPrice(product);
        const match = analyzeMatch(query, title);

        if (price === null) return null;

        return {
          index,
          title,
          price,
          source: product.source || "Unknown store",
          link: getLink(product),
          thumbnail: product.thumbnail || "",
          rating: product.rating ?? null,
          reviews: product.reviews ?? null,
          delivery: product.delivery || "",
          matchScore: match.matchScore,
          possibleMismatch: match.possibleMismatch,
          accessory: isAccessory(title),
          used: isUsed(product),
        } satisfies Candidate;
      })
      .filter((item): item is Candidate => item !== null)
      .filter((item) => item.matchScore >= 0.62)
      .filter((item) => !item.accessory)
      .filter((item) => !item.used);

    const marketMedian = median(
      candidates
        .filter((item) => item.matchScore >= 0.8 && !item.possibleMismatch)
        .map((item) => item.price)
    );

    const reliableForLowest = candidates.filter((item) => {
      const confidence = priceConfidence(item.price, marketMedian);

      return !item.possibleMismatch && confidence !== "low" && item.matchScore >= 0.82;
    });

    const lowestReliablePrice = reliableForLowest.length
      ? Math.min(...reliableForLowest.map((item) => item.price))
      : null;

    const deals = candidates.map((item) =>
      makeDeal(item, marketMedian, lowestReliablePrice)
    );

    const bestDeal =
      deals
        .filter((deal) => !deal.possibleMismatch && deal.matchScore >= 0.82)
        .sort((a, b) => {
          const scoreDifference = b.wantScore - a.wantScore;

          if (Math.abs(scoreDifference) >= 3) return scoreDifference;
          return a.price - b.price;
        })[0] ?? null;

    const products = deals
      .map((deal) => ({
        ...deal,
        badges:
          bestDeal && deal.id === bestDeal.id
            ? ["BEST DEAL", ...deal.badges.filter((badge) => badge !== "BEST DEAL")]
            : deal.badges,
      }))
      .sort((a, b) => {
        if (bestDeal && a.id === bestDeal.id) return -1;
        if (bestDeal && b.id === bestDeal.id) return 1;

        const scoreDifference = b.wantScore - a.wantScore;
        if (Math.abs(scoreDifference) >= 3) return scoreDifference;

        return a.price - b.price;
      })
      .slice(0, 12);

    return NextResponse.json({
      query,
      bestDeal: bestDeal
        ? {
            ...bestDeal,
            badges: [
              "BEST DEAL",
              ...bestDeal.badges.filter((badge) => badge !== "BEST DEAL"),
            ],
          }
        : null,
      products,
      totalFound: products.length,
      analyzedOffers: rawProducts.length,
      medianPrice: marketMedian,
      preparedForTracking: true,
    });
  } catch (error) {
    console.error("WANT search error:", error);

    return NextResponse.json(
      { error: "Failed to search products" },
      { status: 500 }
    );
  }
}
