import { NextRequest, NextResponse } from "next/server";

type ShoppingResult = {
  title?: string;
  price?: string;
  extracted_price?: number;
  link?: string;
  product_link?: string;
  source?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getBudget(query: string): number | null {
  const match = query.match(
    /(?:under|below|less than|max|maximum|up to|до|не дороже|дешевле)\s*€?\s*(\d+(?:[.,]\d+)?)/i
  );

  if (match) {
    return Number(match[1].replace(",", "."));
  }

  const euroMatch = query.match(/€\s*(\d+(?:[.,]\d+)?)/);

  if (euroMatch) {
    return Number(euroMatch[1].replace(",", "."));
  }

  return null;
}

function getImportantWords(query: string) {
  const stopWords = new Set([
    "i",
    "want",
    "find",
    "me",
    "buy",
    "looking",
    "for",
    "under",
    "below",
    "less",
    "than",
    "max",
    "maximum",
    "up",
    "to",
    "please",
    "the",
    "a",
    "an",
    "хочу",
    "найди",
    "мне",
    "до",
    "евро",
    "дешевле",
    "купить",
  ]);

  return normalize(query)
    .split(" ")
    .filter(
      (word) =>
        word.length > 1 &&
        !stopWords.has(word) &&
        !/^\d+$/.test(word)
    );
}

const accessoryWords = [
  "case",
  "cover",
  "protective",
  "protector",
  "strap",
  "skin",
  "shell",
  "holder",
  "keychain",
  "key ring",
  "lock",
  "replacement",
  "ear tips",
  "ear tip",
  "tips",
  "silicone",
  "charger",
  "charging cable",
  "cable",
  "adapter",
  "accessory",
  "accessories",
  "bundle case",
  "compatible with",
];

function scoreProduct(
  product: ShoppingResult,
  importantWords: string[],
  budget: number | null
) {
  const title = normalize(product.title || "");
  const price =
    typeof product.extracted_price === "number"
      ? product.extracted_price
      : null;

  let score = 0;

  // Exact model/name words are the most important signal.
  for (const word of importantWords) {
    if (title.includes(word)) {
      score += 25;
    } else {
      score -= 20;
    }
  }

  const allWordsMatch =
    importantWords.length > 0 &&
    importantWords.every((word) => title.includes(word));

  if (allWordsMatch) {
    score += 100;
  }

  // Strongly punish accessories.
  const accessoryDetected = accessoryWords.some((word) =>
    title.includes(word)
  );

  if (accessoryDetected) {
    score -= 180;
  }

  // Prefer actual products with usable data.
  if (price !== null && price > 0) {
    score += 10;
  }

  if (product.thumbnail) {
    score += 5;
  }

  if (product.link || product.product_link) {
    score += 5;
  }

  // Budget is useful, but must NEVER make a cheap accessory the winner.
  if (budget !== null && price !== null) {
    if (price <= budget) {
      score += 30;

      const distance = budget - price;

      // A product reasonably close to the budget is more believable
      // than a €10 accessory for a €200 electronics search.
      if (distance <= budget * 0.35) {
        score += 20;
      }
    } else {
      const overBudgetPercent = (price - budget) / budget;

      score -= Math.min(80, overBudgetPercent * 100);
    }
  }

  return {
    score,
    accessoryDetected,
    allWordsMatch,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body?.query?.trim();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Search query is required" },
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

    const budget = getBudget(query);
    const importantWords = getImportantWords(query);

    /*
      Remove obvious budget language from the Google Shopping query.
      Google receives mostly the actual product name.
    */
    const searchQuery = query
      .replace(
        /(?:under|below|less than|max|maximum|up to|до|не дороже|дешевле)\s*€?\s*\d+(?:[.,]\d+)?/gi,
        ""
      )
      .replace(/€\s*\d+(?:[.,]\d+)?/g, "")
      .replace(/\b(i want|find me|looking for|please|хочу|найди мне)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const params = new URLSearchParams({
      engine: "google_shopping",
      q: searchQuery || query,
      api_key: apiKey,
      hl: "en",
      gl: "pt",
      num: "40",
    });

    const response = await fetch(
      `https://serpapi.com/search.json?${params.toString()}`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error("SerpAPI error:", response.status, errorText);

      return NextResponse.json(
        {
          error: `SerpAPI returned ${response.status}`,
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    const rawProducts: ShoppingResult[] =
      data.shopping_results ?? [];

    const ranked = rawProducts
      .map((product) => {
        const analysis = scoreProduct(
          product,
          importantWords,
          budget
        );

        return {
          title: product.title || "Unknown product",
          price: product.extracted_price ?? null,
          displayPrice: product.price ?? null,
          source: product.source ?? "Store",
          thumbnail: product.thumbnail ?? null,
          link:
            product.product_link ??
            product.link ??
            null,

          matchScore: Math.round(analysis.score),
          accessory: analysis.accessoryDetected,
          exactModelMatch: analysis.allWordsMatch,

          withinBudget:
            budget !== null &&
            typeof product.extracted_price === "number"
              ? product.extracted_price <= budget
              : null,
        };
      })
      .filter((product) => !product.accessory)
      .filter((product) => product.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    const exactMatches = ranked.filter(
      (product) => product.exactModelMatch
    );

    const candidates =
      exactMatches.length > 0 ? exactMatches : ranked;

    const products = candidates.slice(0, 8);

    const bestWithinBudget =
      budget !== null
        ? products.find(
            (product) =>
              product.withinBudget &&
              product.exactModelMatch
          ) ?? null
        : products[0] ?? null;

    const bestMatch =
      bestWithinBudget ??
      products.find((product) => product.exactModelMatch) ??
      null;

    return NextResponse.json({
      query,
      searchQuery,
      budget,
      totalResults: rawProducts.length,
      filteredResults: products.length,
      bestMatch,
      exactMatchWithinBudget: Boolean(bestWithinBudget),
      products,
    });
  } catch (error) {
    console.error("Search API error:", error);

    return NextResponse.json(
      {
        error: "Failed to search products",
      },
      { status: 500 }
    );
  }
}
