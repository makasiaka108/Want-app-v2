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

function productMatchScore(query: string, title: string) {
  const queryWords = normalize(query)
    .split(" ")
    .filter((word) => word.length > 1);

  const titleNormalized = normalize(title);

  if (!queryWords.length) return 0;

  const matched = queryWords.filter((word) =>
    titleNormalized.includes(word)
  ).length;

  return matched / queryWords.length;
}

function isAccessory(title: string) {
  const text = normalize(title);

  const words = [
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
  ];

  return words.some((word) =>
    text.includes(normalize(word))
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

  const words = [
    "used",
    "second hand",
    "pre owned",
    "preowned",
    "refurbished",
    "renewed",
    "recondicionado",
    "usado",
  ];

  return words.some((word) =>
    text.includes(normalize(word))
  );
}

/*
  Retailer reputation.

  Later we can replace this with a proper retailer database.
*/

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
  ];

  const tier2 = [
    "onbuy",
    "ebay",
    "kuantokusta",
    "radio popular",
    "castro electronica",
    "globaldata",
    "pc diga",
    "pcdiga",
  ];

  if (
    tier1.some((store) =>
      name.includes(normalize(store))
    )
  ) {
    return 100;
  }

  if (
    tier2.some((store) =>
      name.includes(normalize(store))
    )
  ) {
    return 80;
  }

  return 60;
}

function calculateMedian(values: number[]) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (
      (sorted[middle - 1] + sorted[middle]) / 2
    );
  }

  return sorted[middle];
}

function calculatePriceScore(
  price: number,
  median: number
) {
  const ratio = price / median;

  if (ratio <= 0.8) return 100;
  if (ratio <= 0.9) return 95;
  if (ratio <= 1) return 90;
  if (ratio <= 1.1) return 80;
  if (ratio <= 1.2) return 70;
  if (ratio <= 1.35) return 55;

  return 35;
}

function buildReasons(
  match: number,
  retailer: number,
  price: number,
  rating: number | null
) {
  const reasons: string[] = [];

  if (match >= 0.95) {
    reasons.push("Excellent product match");
  } else if (match >= 0.8) {
    reasons.push("Strong product match");
  } else {
    reasons.push("Relevant product match");
  }

  if (retailer >= 100) {
    reasons.push("Trusted retailer");
  } else if (retailer >= 80) {
    reasons.push("Established marketplace");
  }

  if (price >= 95) {
    reasons.push("Excellent price");
  } else if (price >= 80) {
    reasons.push("Competitive price");
  }

  if (rating && rating >= 4.5) {
    reasons.push("Highly rated offer");
  }

  return reasons.slice(0, 3);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const query =
      typeof body.query === "string"
        ? body.query.trim()
        : "";

    if (!query) {
      return NextResponse.json(
        {
          error: "Product name is required",
        },
        {
          status: 400,
        }
      );
    }

    const apiKey = process.env.SERPAPI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "SERPAPI_API_KEY is not configured",
        },
        {
          status: 500,
        }
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
      throw new Error(
        `SerpAPI returned ${response.status}`
      );
    }

    const data = await response.json();

    const rawProducts: ShoppingProduct[] =
      data.shopping_results ?? [];

    /*
      STEP 1
      Clean results.
    */

    const candidates = rawProducts
      .map((product) => {
        const price = getPrice(product);

        const matchScore = productMatchScore(
          query,
          product.title || ""
        );

        return {
          product,
          price,
          matchScore,
        };
      })
      .filter(
        (item) =>
          item.price !== null &&
          item.matchScore >= 0.65 &&
          !isAccessory(item.product.title || "") &&
          !isUsed(item.product)
      );

    /*
      STEP 2
      Find approximate market price.
    */

    const medianPrice = calculateMedian(
      candidates.map(
        (item) => item.price as number
      )
    );

    /*
      STEP 3
      Remove suspicious price outliers.
    */

    const realistic = candidates.filter((item) => {
      if (!medianPrice) return true;

      const price = item.price as number;

      return (
        price >= medianPrice * 0.55 &&
        price <= medianPrice * 2
      );
    });

    /*
      STEP 4
      Calculate WANT SCORE.
    */

    const deals: Deal[] = realistic.map((item) => {
      const product = item.product;
      const price = item.price as number;

      const retailer = retailerScore(
        product.source || ""
      );

      const priceScore = medianPrice
        ? calculatePriceScore(
            price,
            medianPrice
          )
        : 70;

      /*
        WANT SCORE

        50% product accuracy
        25% retailer reputation
        20% price quality
        5% customer rating
      */

      const matchPoints =
        item.matchScore * 100;

      const ratingScore =
        typeof product.rating === "number"
          ? Math.min(
              100,
              (product.rating / 5) * 100
            )
          : 60;

      const wantScore = Math.round(
        matchPoints * 0.5 +
          retailer * 0.25 +
          priceScore * 0.2 +
          ratingScore * 0.05
      );

      return {
        title:
          product.title || "Unknown product",

        price,

        source:
          product.source || "Unknown store",

        link: getLink(product),

        thumbnail:
          product.thumbnail || "",

        rating:
          product.rating ?? null,

        reviews:
          product.reviews ?? null,

        delivery:
          product.delivery || "",

        matchScore: item.matchScore,

        retailerScore: retailer,

        priceScore,

        wantScore,

        reasons: buildReasons(
          item.matchScore,
          retailer,
          priceScore,
          product.rating ?? null
        ),
      };
    });

    /*
      STEP 5
      Rank offers.

      WANT Score first.
      Price breaks close ties.
    */

    deals.sort((a, b) => {
      const scoreDifference =
        b.wantScore - a.wantScore;

      if (Math.abs(scoreDifference) >= 3) {
        return scoreDifference;
      }

      return a.price - b.price;
    });

    const bestDeal = deals[0] ?? null;

    return NextResponse.json({
      query,

      bestDeal,

      products: deals.slice(0, 12),

      totalFound: deals.length,

      medianPrice,

      analyzedOffers: rawProducts.length,
    });
  } catch (error) {
    console.error(
      "WANT search error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to search products",
      },
      {
        status: 500,
      }
    );
  }
}
