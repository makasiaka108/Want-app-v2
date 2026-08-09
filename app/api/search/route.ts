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

function normalize(text: string) {
  return text
    .toLowerCase()
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

function isAccessory(title: string) {
  const accessoryWords = [
    "case",
    "cover",
    "capa",
    "estojo",
    "protector",
    "protetor",
    "replacement",
    "ear tips",
    "earbuds tips",
    "strap",
    "keychain",
    "skin",
    "charger",
    "charging cable",
    "cabo",
    "adapter",
    "adaptador",
    "holder",
    "suporte",
    "bundle case",
  ];

  const normalizedTitle = normalize(title);

  return accessoryWords.some((word) =>
    normalizedTitle.includes(normalize(word))
  );
}

function isUsed(product: ShoppingProduct) {
  const text = normalize(
    [
      product.title,
      product.tag,
      product.second_hand_condition,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const usedWords = [
    "used",
    "second hand",
    "pre owned",
    "preowned",
    "refurbished",
    "renewed",
    "recondicionado",
    "usado",
  ];

  return usedWords.some((word) => text.includes(normalize(word)));
}

function productMatchScore(query: string, title: string) {
  const queryWords = normalize(query)
    .split(" ")
    .filter((word) => word.length > 1);

  const normalizedTitle = normalize(title);

  if (!queryWords.length) return 0;

  const matches = queryWords.filter((word) =>
    normalizedTitle.includes(word)
  ).length;

  return matches / queryWords.length;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query =
      typeof body.query === "string" ? body.query.trim() : "";

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
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`SerpAPI returned ${response.status}`);
    }

    const data = await response.json();

    const rawProducts: ShoppingProduct[] =
      data.shopping_results ?? [];

    const products = rawProducts
      .map((product) => {
        const price = getPrice(product);

        const matchScore = productMatchScore(
          query,
          product.title || ""
        );

        const accessory = isAccessory(product.title || "");
        const used = isUsed(product);

        return {
          title: product.title || "Unknown product",
          price,
          source: product.source || "Unknown store",
          link: getLink(product),
          thumbnail: product.thumbnail || "",
          rating: product.rating ?? null,
          reviews: product.reviews ?? null,
          delivery: product.delivery || "",
          matchScore,
          accessory,
          used,
        };
      })
      .filter((product) => product.price !== null)
      .filter((product) => product.matchScore >= 0.65)
      .filter((product) => !product.accessory)
      .filter((product) => !product.used);

    /*
      Remove suspicious price outliers.

      Example:
      If most real AirPods offers are around €200,
      an €17 result is probably an accessory,
      fake listing or incorrect match.
    */

    const prices = products
      .map((product) => product.price as number)
      .sort((a, b) => a - b);

    let medianPrice: number | null = null;

    if (prices.length) {
      const middle = Math.floor(prices.length / 2);

      medianPrice =
        prices.length % 2 === 0
          ? (prices[middle - 1] + prices[middle]) / 2
          : prices[middle];
    }

    const filteredProducts = products
      .filter((product) => {
        if (!medianPrice) return true;

        const price = product.price as number;

        return (
          price >= medianPrice * 0.45 &&
          price <= medianPrice * 2.5
        );
      })
      .map((product) => {
        let wantScore = product.matchScore * 70;

        if (product.rating) {
          wantScore += Math.min(product.rating / 5, 1) * 15;
        }

        if (product.reviews) {
          wantScore +=
            Math.min(Math.log10(product.reviews + 1) / 4, 1) * 10;
        }

        if (
          medianPrice &&
          (product.price as number) <= medianPrice
        ) {
          wantScore += 5;
        }

        return {
          ...product,
          wantScore: Math.round(
            Math.min(100, Math.max(0, wantScore))
          ),
        };
      });

    /*
      BEST DEAL:
      First prioritize product accuracy.
      Then rank by price and trust signals.
    */

    const rankedProducts = [...filteredProducts].sort((a, b) => {
      const matchDifference = b.matchScore - a.matchScore;

      if (Math.abs(matchDifference) > 0.1) {
        return matchDifference;
      }

      const scoreDifference = b.wantScore - a.wantScore;

      if (Math.abs(scoreDifference) >= 8) {
        return scoreDifference;
      }

      return (a.price as number) - (b.price as number);
    });

    const bestDeal = rankedProducts[0] ?? null;

    return NextResponse.json({
      query,
      bestDeal,
      products: rankedProducts.slice(0, 12),
      totalFound: rankedProducts.length,
      medianPrice,
    });
  } catch (error) {
    console.error("WANT search error:", error);

    return NextResponse.json(
      {
        error: "Failed to search products",
      },
      {
        status: 500,
      }
    );
  }
}
