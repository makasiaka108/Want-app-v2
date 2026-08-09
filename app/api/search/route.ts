import { NextRequest, NextResponse } from "next/server";

type RawProduct = {
  title?: string;
  price?: string;
  extracted_price?: number;
  link?: string;
  product_link?: string;
  source?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  delivery?: string;
};

type Condition =
  | "new"
  | "used"
  | "refurbished"
  | "unknown";

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getBudget(query: string): number | null {
  const patterns = [
    /(?:under|below|less than|max|maximum|up to)\s*€?\s*(\d+(?:[.,]\d+)?)/i,
    /(?:до|дешевле|не дороже)\s*€?\s*(\d+(?:[.,]\d+)?)/i,
    /€\s*(\d+(?:[.,]\d+)?)/i,
    /(\d+(?:[.,]\d+)?)\s*€/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);

    if (match) {
      return Number(match[1].replace(",", "."));
    }
  }

  return null;
}

function cleanSearchQuery(query: string) {
  return query
    .replace(
      /(?:under|below|less than|max|maximum|up to|до|дешевле|не дороже)\s*€?\s*\d+(?:[.,]\d+)?/gi,
      ""
    )
    .replace(/€\s*\d+(?:[.,]\d+)?/g, "")
    .replace(/\d+(?:[.,]\d+)?\s*€/g, "")
    .replace(
      /\b(i want|find me|find|looking for|please|show me|buy|хочу|найди|найди мне|покажи|купить)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function getProductWords(searchQuery: string) {
  const ignored = new Set([
    "the",
    "a",
    "an",
    "for",
    "with",
    "and",
    "or",
    "new",
    "brand",
    "original",
    "genuine",
  ]);

  return normalize(searchQuery)
    .split(" ")
    .filter(
      (word) =>
        word.length > 1 &&
        !ignored.has(word)
    );
}

const accessoryTerms = [
  "case",
  "cover",
  "covers",
  "protector",
  "protective case",
  "protective cover",
  "skin",
  "shell",
  "strap",
  "holder",
  "keychain",
  "key ring",
  "ear tips",
  "ear tip",
  "earbuds tips",
  "silicone tips",
  "replacement tips",
  "charging cable",
  "usb cable",
  "cable",
  "adapter",
  "stand",
  "dock",
  "cleaning kit",
  "cleaner",
  "accessory",
  "accessories",
  "security lock",
  "lock bundle",
];

const suspiciousTerms = [
  "replica",
  "copy",
  "clone",
  "fake",
  "compatible",
  "style",
  "replacement",
  "for apple",
  "for airpods",
];

const usedTerms = [
  "used",
  "pre owned",
  "pre-owned",
  "second hand",
  "second-hand",
  "usado",
  "usados",
  "segunda mao",
  "segunda mão",
];

const refurbishedTerms = [
  "refurbished",
  "renewed",
  "reconditioned",
  "recondicionado",
  "recondicionada",
];

const newTerms = [
  "new",
  "brand new",
  "novo",
  "nova",
  "sealed",
  "selado",
];

function detectCondition(title: string): Condition {
  const text = normalize(title);

  if (
    refurbishedTerms.some((term) =>
      text.includes(normalize(term))
    )
  ) {
    return "refurbished";
  }

  if (
    usedTerms.some((term) =>
      text.includes(normalize(term))
    )
  ) {
    return "used";
  }

  if (
    newTerms.some((term) =>
      text.includes(normalize(term))
    )
  ) {
    return "new";
  }

  return "unknown";
}

function hasAccessoryTerm(title: string) {
  const text = normalize(title);

  return accessoryTerms.some((term) =>
    text.includes(normalize(term))
  );
}

function hasSuspiciousTerm(title: string) {
  const text = normalize(title);

  return suspiciousTerms.some((term) =>
    text.includes(normalize(term))
  );
}

function getWordMatchRatio(
  title: string,
  productWords: string[]
) {
  if (!productWords.length) return 0;

  const text = normalize(title);

  const matched = productWords.filter((word) =>
    text.includes(word)
  ).length;

  return matched / productWords.length;
}

function median(numbers: number[]) {
  if (!numbers.length) return null;

  const sorted = [...numbers].sort(
    (a, b) => a - b
  );

  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (
      (sorted[middle - 1] + sorted[middle]) /
      2
    );
  }

  return sorted[middle];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const query =
      typeof body?.query === "string"
        ? body.query.trim()
        : "";

    if (!query) {
      return NextResponse.json(
        {
          error: "Search query is required",
        },
        {
          status: 400,
        }
      );
    }

    const apiKey =
      process.env.SERPAPI_API_KEY;

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

    const budget = getBudget(query);

    const searchQuery =
      cleanSearchQuery(query) || query;

    const productWords =
      getProductWords(searchQuery);

    const params = new URLSearchParams({
      engine: "google_shopping",
      q: searchQuery,
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
      console.error(
        "SerpAPI status:",
        response.status
      );

      return NextResponse.json(
        {
          error:
            "Product search provider failed",
        },
        {
          status: 502,
        }
      );
    }

    const data = await response.json();

    const rawProducts: RawProduct[] =
      data.shopping_results ?? [];

    /*
      STEP 1

      Calculate basic relevance before looking
      at prices.
    */

    const prepared = rawProducts
      .map((product, index) => {
        const title =
          product.title?.trim() ||
          "Unknown product";

        const price =
          typeof product.extracted_price ===
          "number"
            ? product.extracted_price
            : null;

        const wordMatchRatio =
          getWordMatchRatio(
            title,
            productWords
          );

        const accessory =
          hasAccessoryTerm(title);

        const suspicious =
          hasSuspiciousTerm(title);

        const condition =
          detectCondition(title);

        return {
          originalIndex: index,

          title,
          price,

          displayPrice:
            product.price ?? null,

          source:
            product.source ?? "Store",

          thumbnail:
            product.thumbnail ?? null,

          link:
            product.product_link ??
            product.link ??
            null,

          rating:
            product.rating ?? null,

          reviews:
            product.reviews ?? null,

          delivery:
            product.delivery ?? null,

          condition,

          accessory,
          suspicious,
          wordMatchRatio,

          exactModelMatch:
            wordMatchRatio >= 0.99,

          withinBudget:
            budget !== null &&
            price !== null
              ? price <= budget
              : null,
        };
      });

    /*
      STEP 2

      Build a market-price baseline only from
      reasonably relevant products.

      This lets WANT detect suspiciously cheap
      listings without hardcoding AirPods,
      MacBooks, cameras, etc.
    */

    const relevantPrices = prepared
      .filter(
        (product) =>
          !product.accessory &&
          !product.suspicious &&
          product.wordMatchRatio >= 0.65 &&
          product.price !== null &&
          product.price > 0
      )
      .map((product) => product.price as number);

    const marketMedian =
      median(relevantPrices);

    /*
      STEP 3

      Score every offer.
    */

    const ranked = prepared
      .map((product) => {
        let score = 0;

        /*
          PRODUCT RELEVANCE
        */

        score +=
          product.wordMatchRatio * 160;

        if (product.exactModelMatch) {
          score += 70;
        }

        if (product.wordMatchRatio < 0.5) {
          score -= 100;
        }

        /*
          ACCESSORIES / WRONG PRODUCT
        */

        if (product.accessory) {
          score -= 300;
        }

        if (product.suspicious) {
          score -= 140;
        }

        /*
          CONDITION
        */

        if (product.condition === "new") {
          score += 15;
        }

        if (
          product.condition ===
          "refurbished"
        ) {
          score -= 15;
        }

        if (product.condition === "used") {
          score -= 25;
        }

        /*
          PRICE QUALITY

          A very cheap result isn't automatically
          deleted, but its confidence falls.
        */

        let priceConfidence:
          | "normal"
          | "low"
          | "very-low"
          | "unknown" = "unknown";

        if (
          product.price !== null &&
          marketMedian !== null &&
          marketMedian > 0
        ) {
          const ratio =
            product.price / marketMedian;

          if (ratio < 0.35) {
            score -= 130;
            priceConfidence = "very-low";
          } else if (ratio < 0.55) {
            score -= 65;
            priceConfidence = "low";
          } else {
            priceConfidence = "normal";
          }
        }

        /*
          USER BUDGET

          Budget helps rank legitimate products,
          but cannot rescue an accessory or
          suspicious listing.
        */

        if (
          budget !== null &&
          product.price !== null
        ) {
          if (product.price <= budget) {
            score += 35;

            const difference =
              budget - product.price;

            if (
              difference <=
              budget * 0.25
            ) {
              score += 15;
            }
          } else {
            const over =
              (product.price - budget) /
              budget;

            score -= Math.min(
              45,
              over * 40
            );
          }
        }

        /*
          STORE DATA QUALITY
        */

        if (product.thumbnail) {
          score += 4;
        }

        if (product.link) {
          score += 4;
        }

        if (
          typeof product.rating ===
          "number"
        ) {
          score += Math.min(
            10,
            product.rating * 2
          );
        }

        if (
          typeof product.reviews ===
            "number" &&
          product.reviews > 20
        ) {
          score += 5;
        }

        return {
          ...product,

          matchScore: Math.round(score),

          priceConfidence,
        };
      })

      /*
        Completely remove obvious accessories
        from the main product list.
      */

      .filter(
        (product) =>
          !product.accessory &&
          product.wordMatchRatio >= 0.5
      )

      .sort(
        (a, b) =>
          b.matchScore - a.matchScore
      );

    /*
      STEP 4

      Reliable products.

      Very suspicious prices should still be
      available internally, but they shouldn't
      automatically become BEST MATCH.
    */

    const reliable = ranked.filter(
      (product) =>
        !product.suspicious &&
        product.priceConfidence !==
          "very-low" &&
        product.wordMatchRatio >= 0.65
    );

    const exactReliable =
      reliable.filter(
        (product) =>
          product.exactModelMatch
      );

    /*
      BEST MATCH
    */

    let bestMatch = null;

    if (budget !== null) {
      /*
        First preference:
        exact + reliable + within budget.
      */

      bestMatch =
        exactReliable.find(
          (product) =>
            product.withinBudget
        ) ?? null;

      /*
        If nothing trustworthy is inside the
        budget, show closest trustworthy exact
        model above budget.
      */

      if (!bestMatch) {
        const aboveBudget =
          exactReliable
            .filter(
              (product) =>
                product.price !== null &&
                product.price > budget
            )
            .sort(
              (a, b) =>
                (a.price ?? Infinity) -
                (b.price ?? Infinity)
            );

        bestMatch =
          aboveBudget[0] ?? null;
      }
    } else {
      bestMatch =
        exactReliable[0] ??
        reliable[0] ??
        null;
    }

    /*
      Additional useful categories.
    */

    const cheapestReliable =
      [...reliable]
        .filter(
          (product) =>
            product.price !== null
        )
        .sort(
          (a, b) =>
            (a.price ?? Infinity) -
            (b.price ?? Infinity)
        )[0] ?? null;

    const trustedBest =
      reliable[0] ?? null;

    /*
      Only BEST MATCH gets the best-match flag.
    */

    const products = ranked
      .slice(0, 10)
      .map((product) => ({
        ...product,

        isBestMatch:
          bestMatch !== null &&
          product.originalIndex ===
            bestMatch.originalIndex,
      }));

    const exactMatchWithinBudget =
      budget !== null
        ? exactReliable.some(
            (product) =>
              product.withinBudget
          )
        : false;

    let message = "";

    if (!bestMatch) {
      message =
        "No reliable exact product match was found.";
    } else if (
      budget !== null &&
      bestMatch.price !== null &&
      bestMatch.price > budget
    ) {
      const difference =
        bestMatch.price - budget;

      message =
        `No reliable exact match was found under €${budget}. ` +
        `The closest reliable offer is €${bestMatch.price.toFixed(
          2
        )}, €${difference.toFixed(
          2
        )} above your target.`;
    } else if (
      budget !== null &&
      bestMatch.withinBudget
    ) {
      message =
        `A reliable match was found within your €${budget} budget.`;
    } else {
      message =
        "A reliable product match was found.";
    }

    return NextResponse.json({
      query,
      searchQuery,
      budget,

      totalResults:
        rawProducts.length,

      filteredResults:
        products.length,

      marketMedian,

      exactMatchWithinBudget,

      message,

      bestMatch,

      cheapestReliable,

      trustedBest,

      products,
    });
  } catch (error) {
    console.error(
      "Search API error:",
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
