"use client";

import { useState } from "react";
import {
  Home,
  Heart,
  Sparkles,
  Users,
  User,
  Search,
  Bell,
  TrendingDown,
  ArrowRight,
  LoaderCircle,
  Check,
  ExternalLink,
} from "lucide-react";

type Product = {
  title?: string;
  price?: string;
  extracted_price?: number;
  source?: string;
  link?: string;
  product_link?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
};

type Wish = {
  name: string;
  price?: number;
  target?: number;
  discount?: number;
  score?: number;
  icon: string;
  custom?: boolean;

  source?: string;
  link?: string;
  image?: string;
  underBudget?: boolean;
};

const initialWishes: Wish[] = [
  {
    name: "Oakley Sutro",
    price: 119,
    target: 115,
    discount: 30,
    score: 94,
    icon: "🕶️",
  },
  {
    name: "Sony WH-1000XM6",
    price: 329,
    target: 320,
    discount: 15,
    score: 91,
    icon: "🎧",
  },
  {
    name: "MacBook Pro 14",
    price: 2049,
    target: 1999,
    discount: 11,
    score: 87,
    icon: "💻",
  },
];

function extractBudget(text: string) {
  const patterns = [
    /under\s*€?\s*(\d+(?:[.,]\d+)?)/i,
    /below\s*€?\s*(\d+(?:[.,]\d+)?)/i,
    /less\s+than\s*€?\s*(\d+(?:[.,]\d+)?)/i,
    /max(?:imum)?\s*€?\s*(\d+(?:[.,]\d+)?)/i,
    /up\s+to\s*€?\s*(\d+(?:[.,]\d+)?)/i,

    /до\s*€?\s*(\d+(?:[.,]\d+)?)/i,
    /не\s+дороже\s*€?\s*(\d+(?:[.,]\d+)?)/i,
    /дешевле\s*€?\s*(\d+(?:[.,]\d+)?)/i,

    /€\s*(\d+(?:[.,]\d+)?)\s*(?:or less|max)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return Number(match[1].replace(",", "."));
    }
  }

  return undefined;
}

function cleanProductQuery(text: string) {
  return text
    .replace(
      /under\s*€?\s*\d+(?:[.,]\d+)?/gi,
      ""
    )
    .replace(
      /below\s*€?\s*\d+(?:[.,]\d+)?/gi,
      ""
    )
    .replace(
      /less\s+than\s*€?\s*\d+(?:[.,]\d+)?/gi,
      ""
    )
    .replace(
      /max(?:imum)?\s*€?\s*\d+(?:[.,]\d+)?/gi,
      ""
    )
    .replace(
      /up\s+to\s*€?\s*\d+(?:[.,]\d+)?/gi,
      ""
    )
    .replace(
      /до\s*€?\s*\d+(?:[.,]\d+)?/gi,
      ""
    )
    .replace(
      /не\s+дороже\s*€?\s*\d+(?:[.,]\d+)?/gi,
      ""
    )
    .replace(
      /дешевле\s*€?\s*\d+(?:[.,]\d+)?/gi,
      ""
    )
    .replace(/^i\s+want\s+/i, "")
    .replace(/^find\s+me\s+/i, "")
    .replace(/^find\s+/i, "")
    .replace(/^хочу\s+/i, "")
    .replace(/^найди\s+(мне\s+)?/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getProductPrice(product: Product) {
  if (
    typeof product.extracted_price === "number" &&
    Number.isFinite(product.extracted_price)
  ) {
    return product.extracted_price;
  }

  if (product.price) {
    const cleaned = product.price
      .replace(/[^\d,.-]/g, "")
      .replace(",", ".");

    const parsed = Number.parseFloat(cleaned);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function getProductLink(product: Product) {
  return product.product_link || product.link;
}

function calculateScore(
  price?: number,
  budget?: number,
  rating?: number
) {
  let score = 75;

  if (price && budget) {
    if (price <= budget) {
      const saving = ((budget - price) / budget) * 100;
      score += Math.min(15, saving);
    } else {
      const over = ((price - budget) / budget) * 100;
      score -= Math.min(30, over);
    }
  }

  if (rating) {
    score += Math.max(0, rating - 4) * 10;
  }

  return Math.max(1, Math.min(99, Math.round(score)));
}

function formatPrice(price?: number) {
  if (price === undefined) return "—";

  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(price);
}

export default function Page() {
  const [tab, setTab] = useState("Home");
  const [query, setQuery] = useState("");
  const [wishes, setWishes] =
    useState<Wish[]>(initialWishes);

  const [status, setStatus] = useState<
    "idle" | "searching" | "added" | "error"
  >("idle");

  const [lastSearch, setLastSearch] = useState("");
  const [budget, setBudget] =
    useState<number | undefined>();

  const [searchResults, setSearchResults] =
    useState<Product[]>([]);

  const [errorMessage, setErrorMessage] = useState("");

  async function handleSearch() {
    const cleanQuery = query.trim();

    if (!cleanQuery || status === "searching") {
      return;
    }

    const detectedBudget = extractBudget(cleanQuery);
    const productQuery =
      cleanProductQuery(cleanQuery) || cleanQuery;

    setLastSearch(cleanQuery);
    setBudget(detectedBudget);
    setStatus("searching");
    setSearchResults([]);
    setErrorMessage("");

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: productQuery,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Product search failed"
        );
      }

      const rawProducts: Product[] =
        Array.isArray(data.products)
          ? data.products
          : [];

      const productsWithPrice = rawProducts
        .map((product) => ({
          ...product,
          extracted_price:
            getProductPrice(product),
        }))
        .filter(
          (product) =>
            typeof product.extracted_price === "number"
        );

      let rankedProducts = [...productsWithPrice];

      if (detectedBudget !== undefined) {
        rankedProducts.sort((a, b) => {
          const aPrice =
            a.extracted_price ?? Infinity;
          const bPrice =
            b.extracted_price ?? Infinity;

          const aUnder =
            aPrice <= detectedBudget;
          const bUnder =
            bPrice <= detectedBudget;

          if (aUnder && !bUnder) return -1;
          if (!aUnder && bUnder) return 1;

          return aPrice - bPrice;
        });
      } else {
        rankedProducts.sort(
          (a, b) =>
            (a.extracted_price ?? Infinity) -
            (b.extracted_price ?? Infinity)
        );
      }

      const topProducts =
        rankedProducts.slice(0, 5);

      setSearchResults(topProducts);

      const bestProduct = topProducts[0];

      if (!bestProduct) {
        setStatus("error");
        setErrorMessage(
          "No matching shopping results were found."
        );
        return;
      }

      const bestPrice =
        bestProduct.extracted_price;

      const newWish: Wish = {
        name:
          bestProduct.title ||
          productQuery,
        price: bestPrice,
        target: detectedBudget,
        score: calculateScore(
          bestPrice,
          detectedBudget,
          bestProduct.rating
        ),
        icon: "✨",
        custom: true,
        source:
          bestProduct.source ||
          "Online store",
        link: getProductLink(bestProduct),
        image: bestProduct.thumbnail,
        underBudget:
          detectedBudget !== undefined &&
          bestPrice !== undefined
            ? bestPrice <= detectedBudget
            : undefined,
      };

      setWishes((current) => [
        newWish,
        ...current.filter(
          (wish) =>
            wish.name !== newWish.name
        ),
      ]);

      setStatus("added");
      setQuery("");
    } catch (error) {
      console.error(error);

      setStatus("error");

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to search products"
      );
    }
  }

  const bestResult = searchResults[0];

  return (
    <main className="shell">
      <header>
        <div>
          <div className="logo">
            WANT<span>.</span>
          </div>

          <small>AI SHOPPING AGENT</small>
        </div>

        <div className="actions">
          <button aria-label="Search">
            <Search />
          </button>

          <button aria-label="Notifications">
            <Bell />
          </button>
        </div>
      </header>

      <section className="hero">
        <label>
          <Sparkles size={14} />
          YOUR SHOPPING COPILOT
        </label>

        <h1>
          What do you <em>want?</em>
        </h1>

        <p>
          Tell WANT. what you're looking for.
          AI searches live shopping results,
          compares prices and finds the best
          option for your budget.
        </p>

        <div className="ask">
          <input
            value={query}
            onChange={(e) =>
              setQuery(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            placeholder='Try “AirPods Pro 3 under €200”'
          />

          <button
            onClick={handleSearch}
            disabled={
              !query.trim() ||
              status === "searching"
            }
            aria-label="Submit"
          >
            {status === "searching" ? (
              <LoaderCircle className="spin" />
            ) : (
              <ArrowRight />
            )}
          </button>
        </div>

        {status === "searching" && (
          <div className="search-result">
            <small>
              WANT IS SEARCHING LIVE
            </small>

            <strong>{lastSearch}</strong>

            <p>
              Searching stores, comparing
              prices and checking your budget...
            </p>
          </div>
        )}

        {status === "added" &&
          bestResult && (
            <div className="search-result success">
              <small>
                <Check size={13} />
                BEST MATCH FOUND
              </small>

              <strong>
                {bestResult.title}
              </strong>

              <p>
                {formatPrice(
                  bestResult.extracted_price
                )}
                {bestResult.source
                  ? ` · ${bestResult.source}`
                  : ""}
              </p>

              {budget !== undefined && (
                <p>
                  Budget:{" "}
                  {formatPrice(budget)} ·{" "}
                  {bestResult.extracted_price !==
                    undefined &&
                  bestResult.extracted_price <=
                    budget
                    ? "✓ Within budget"
                    : "Above budget"}
                </p>
              )}
            </div>
          )}

        {status === "error" && (
          <div className="search-result">
            <small>SEARCH ERROR</small>

            <strong>
              Could not find a deal
            </strong>

            <p>{errorMessage}</p>
          </div>
        )}
      </section>

      {searchResults.length > 0 && (
        <>
          <div className="title">
            <b>● LIVE DEALS</b>
            <span>
              {searchResults.length} found
            </span>
          </div>

          <section className="cards">
            {searchResults.map(
              (product, i) => {
                const price =
                  product.extracted_price;

                const isUnderBudget =
                  budget !== undefined &&
                  price !== undefined &&
                  price <= budget;

                const link =
                  getProductLink(product);

                return (
                  <article
                    key={`result-${
                      product.title || i
                    }-${i}`}
                  >
                    <i>#{i + 1}</i>

                    {product.thumbnail ? (
                      <strong
                        style={{
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={
                            product.thumbnail
                          }
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit:
                              "contain",
                          }}
                        />
                      </strong>
                    ) : (
                      <strong>✨</strong>
                    )}

                    <div>
                      <b>
                        {product.title ||
                          "Product"}
                      </b>

                      <small>
                        {product.source ||
                          "Online store"}

                        {product.rating
                          ? ` · ★ ${product.rating}`
                          : ""}
                      </small>
                    </div>

                    <aside>
                      <b>
                        {formatPrice(price)}
                      </b>

                      {budget !==
                        undefined && (
                        <small>
                          {isUnderBudget
                            ? "✓ IN BUDGET"
                            : "OVER BUDGET"}
                        </small>
                      )}

                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 10,
                            marginTop: 5,
                            color:
                              "var(--purple, #a66cff)",
                            textDecoration:
                              "none",
                          }}
                        >
                          VIEW DEAL{" "}
                          <ExternalLink
                            size={9}
                            style={{
                              display:
                                "inline",
                            }}
                          />
                        </a>
                      )}
                    </aside>
                  </article>
                );
              }
            )}
          </section>
        </>
      )}

      <section className="stats">
        <div>
          <b>{wishes.length}</b>
          <span>Wishes tracked</span>
        </div>

        <div>
          <b>
            {
              wishes.filter(
                (wish) =>
                  wish.underBudget === true
              ).length
            }
          </b>
          <span>Targets hit</span>
        </div>

        <div>
          <b>€184</b>
          <span>Potential savings</span>
        </div>
      </section>

      <div className="title">
        <b>● AI TOP PICKS</b>
        <span>View all</span>
      </div>

      <section className="cards">
        {wishes.map((wish, i) => (
          <article
            key={`${wish.name}-${i}`}
          >
            <i>#{i + 1}</i>

            {wish.image ? (
              <strong
                style={{
                  overflow: "hidden",
                }}
              >
                <img
                  src={wish.image}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </strong>
            ) : (
              <strong>{wish.icon}</strong>
            )}

            <div>
              <b>{wish.name}</b>

              {wish.custom ? (
                <small>
                  {wish.source
                    ? `Found at ${wish.source}`
                    : "Live shopping result"}
                </small>
              ) : (
                <small>
                  Target €{wish.target} ·{" "}
                  <u>
                    <TrendingDown
                      size={12}
                    />
                    {wish.discount}%
                  </u>
                </small>
              )}
            </div>

            <aside>
              <b>
                {wish.price !== undefined
                  ? formatPrice(wish.price)
                  : "—"}
              </b>

              {wish.custom ? (
                <>
                  <small>
                    {wish.underBudget === true
                      ? "TARGET HIT"
                      : wish.target
                      ? `TARGET ${formatPrice(
                          wish.target
                        )}`
                      : "LIVE RESULT"}
                  </small>

                  {wish.link && (
                    <a
                      href={wish.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 10,
                        marginTop: 5,
                        color:
                          "var(--purple, #a66cff)",
                        textDecoration: "none",
                      }}
                    >
                      VIEW DEAL
                    </a>
                  )}
                </>
              ) : (
                <small>
                  WANT SCORE {wish.score}
                </small>
              )}
            </aside>
          </article>
        ))}
      </section>

      <section className="insight">
        <div>
          <label>
            <Sparkles size={13} />
            AI INSIGHT
          </label>

          {bestResult ? (
            <>
              <h2>
                {budget !== undefined &&
                bestResult.extracted_price !==
                  undefined &&
                bestResult.extracted_price <=
                  budget
                  ? "We found an option within your budget."
                  : "WANT compared live shopping results."}
              </h2>

              <p>
                Best current result:{" "}
                {bestResult.title} for{" "}
                {formatPrice(
                  bestResult.extracted_price
                )}
                {bestResult.source
                  ? ` at ${bestResult.source}.`
                  : "."}
              </p>
            </>
          ) : (
            <>
              <h2>
                Oakley is close to your
                target.
              </h2>

              <p>
                Current price is only €4
                above target and near its
                90-day low.
              </p>
            </>
          )}
        </div>

        {bestResult &&
        getProductLink(bestResult) ? (
          <button
            onClick={() => {
              window.open(
                getProductLink(
                  bestResult
                ),
                "_blank"
              );
            }}
          >
            Best deal
            <ArrowRight size={15} />
          </button>
        ) : (
          <button>
            Check deals
            <ArrowRight size={15} />
          </button>
        )}
      </section>

      <div className="title">
        <b>COMMUNITY TRENDING</b>
        <span>Explore</span>
      </div>

      <section className="community">
        <b>👤 👤 👤</b>

        <div>
          <b>
            1,284 people want this
          </b>

          <small>
            Trending products & shared
            deals
          </small>
        </div>

        <button>+</button>
      </section>

      <nav>
        {[
          ["Home", Home],
          ["Wishes", Heart],
          ["AI", Sparkles],
          ["Community", Users],
          ["Profile", User],
        ].map(([name, Icon]: any) => (
          <button
            className={
              tab === name ? "active" : ""
            }
            onClick={() => setTab(name)}
            key={name}
          >
            <Icon />
            <span>{name}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
