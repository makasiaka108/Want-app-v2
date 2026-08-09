"use client";

import { useMemo, useState } from "react";
import {
  Home,
  Heart,
  Sparkles,
  Users,
  User,
  Search,
  Bell,
  ArrowRight,
  LoaderCircle,
  ExternalLink,
  Star,
  Check,
  TrendingDown,
} from "lucide-react";

type Product = {
  title?: string;
  price?: string | number;
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

type RankedProduct = Product & {
  wantScore: number;
  reasons: string[];
  numericPrice: number | null;
};

type SearchResponse = {
  query?: string;
  products?: Product[];
  error?: string;
};

function getNumericPrice(product: Product): number | null {
  if (
    typeof product.extracted_price === "number" &&
    Number.isFinite(product.extracted_price)
  ) {
    return product.extracted_price;
  }

  if (typeof product.price === "number" && Number.isFinite(product.price)) {
    return product.price;
  }

  if (typeof product.price === "string") {
    const cleaned = product.price
      .replace(/\s/g, "")
      .replace(/[^\d,.-]/g, "")
      .replace(",", ".");

    const value = Number.parseFloat(cleaned);

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function formatPrice(product: RankedProduct) {
  if (product.numericPrice !== null) {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(product.numericPrice);
  }

  return product.price || "Price unavailable";
}

function productUrl(product: Product) {
  return product.product_link || product.link || "";
}

function rankProducts(products: Product[]): RankedProduct[] {
  const validPrices = products
    .map(getNumericPrice)
    .filter((price): price is number => price !== null && price > 0);

  const sortedPrices = [...validPrices].sort((a, b) => a - b);

  const medianPrice =
    sortedPrices.length === 0
      ? null
      : sortedPrices[Math.floor(sortedPrices.length / 2)];

  return products
    .map((product) => {
      const price = getNumericPrice(product);

      let score = 50;
      const reasons: string[] = [];

      if (price !== null && medianPrice !== null) {
        const ratio = price / medianPrice;

        if (ratio <= 0.8) {
          score += 25;
          reasons.push("Excellent price");
        } else if (ratio <= 0.95) {
          score += 18;
          reasons.push("Below typical price");
        } else if (ratio <= 1.08) {
          score += 10;
          reasons.push("Fair market price");
        } else if (ratio >= 1.35) {
          score -= 12;
          reasons.push("Higher than similar offers");
        }
      }

      if (product.rating) {
        if (product.rating >= 4.7) {
          score += 15;
          reasons.push("Excellent rating");
        } else if (product.rating >= 4.4) {
          score += 11;
          reasons.push("Highly rated");
        } else if (product.rating >= 4) {
          score += 6;
          reasons.push("Good rating");
        }
      }

      if (product.reviews) {
        if (product.reviews >= 1000) {
          score += 10;
          reasons.push("Many verified reviews");
        } else if (product.reviews >= 100) {
          score += 6;
          reasons.push("Strong review history");
        }
      }

      if (product.source) {
        score += 3;
        reasons.push(`Available at ${product.source}`);
      }

      if (product.delivery) {
        score += 3;
        reasons.push("Delivery information available");
      }

      if (product.second_hand_condition) {
        score -= 8;
        reasons.push("Check item condition");
      }

      score = Math.max(1, Math.min(99, score));

      return {
        ...product,
        numericPrice: price,
        wantScore: score,
        reasons: reasons.slice(0, 3),
      };
    })
    .sort((a, b) => {
      if (b.wantScore !== a.wantScore) {
        return b.wantScore - a.wantScore;
      }

      if (a.numericPrice === null) return 1;
      if (b.numericPrice === null) return -1;

      return a.numericPrice - b.numericPrice;
    });
}

export default function Page() {
  const [tab, setTab] = useState("AI");
  const [query, setQuery] = useState("");
  const [lastSearch, setLastSearch] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [tracked, setTracked] = useState<string[]>([]);

  const rankedProducts = useMemo(
    () => rankProducts(products),
    [products]
  );

  const bestDeal = rankedProducts[0];

  async function handleSearch() {
    const cleanQuery = query.trim();

    if (!cleanQuery || loading) return;

    setLoading(true);
    setError("");
    setProducts([]);
    setLastSearch(cleanQuery);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: cleanQuery,
        }),
      });

      const data: SearchResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setProducts(
        Array.isArray(data.products) ? data.products : []
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleTrack(product: RankedProduct) {
    const key =
      productUrl(product) ||
      `${product.title}-${product.source}-${product.numericPrice}`;

    setTracked((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  }

  function isTracked(product: RankedProduct) {
    const key =
      productUrl(product) ||
      `${product.title}-${product.source}-${product.numericPrice}`;

    return tracked.includes(key);
  }

  function openDeal(product: RankedProduct) {
    const url = productUrl(product);

    if (!url) return;

    window.open(url, "_blank", "noopener,noreferrer");
  }

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
          Enter a product name. WANT searches live shopping
          offers, compares them and ranks the best deals.
        </p>

        <div className="ask">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSearch();
              }
            }}
            placeholder='Try “AirPods Pro 3”'
          />

          <button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            aria-label="Search products"
          >
            {loading ? (
              <LoaderCircle className="spin" />
            ) : (
              <ArrowRight />
            )}
          </button>
        </div>
      </section>

      {loading && (
        <section className="search-result">
          <small>
            <Sparkles size={13} />
            WANT IS SEARCHING
          </small>

          <strong>{lastSearch}</strong>

          <p>
            Finding live offers and comparing prices,
            ratings and stores...
          </p>
        </section>
      )}

      {error && (
        <section className="search-result">
          <small>SEARCH ERROR</small>

          <strong>{error}</strong>

          <p>Please try the search again.</p>
        </section>
      )}

      {!loading &&
        !error &&
        lastSearch &&
        rankedProducts.length === 0 && (
          <section className="search-result">
            <small>NO DEALS FOUND</small>

            <strong>{lastSearch}</strong>

            <p>
              Try using only the exact product name without
              a price or extra description.
            </p>
          </section>
        )}

      {bestDeal && (
        <section className="best-deal">
          <div className="best-label">
            <Sparkles size={13} />
            BEST DEAL
          </div>

          <div className="best-content">
            {bestDeal.thumbnail ? (
              <img
                src={bestDeal.thumbnail}
                alt={bestDeal.title || "Product"}
              />
            ) : (
              <div className="product-placeholder">
                <Sparkles />
              </div>
            )}

            <div className="best-info">
              <h2>{bestDeal.title}</h2>

              <p>
                {bestDeal.source
                  ? `Found at ${bestDeal.source}`
                  : "Live shopping offer"}
              </p>

              <div className="reason-list">
                {bestDeal.reasons.map((reason) => (
                  <span key={reason}>
                    <Check size={12} />
                    {reason}
                  </span>
                ))}
              </div>
            </div>

            <aside>
              <strong>{formatPrice(bestDeal)}</strong>

              <span>
                WANT SCORE {bestDeal.wantScore}
              </span>
            </aside>
          </div>

          <div className="best-actions">
            <button
              className="track-button"
              onClick={() => toggleTrack(bestDeal)}
            >
              <Heart
                size={16}
                fill={
                  isTracked(bestDeal)
                    ? "currentColor"
                    : "none"
                }
              />

              {isTracked(bestDeal)
                ? "Tracking price"
                : "Track price"}
            </button>

            <button
              className="deal-button"
              disabled={!productUrl(bestDeal)}
              onClick={() => openDeal(bestDeal)}
            >
              View deal
              <ExternalLink size={15} />
            </button>
          </div>
        </section>
      )}

      {rankedProducts.length > 0 && (
        <>
          <div className="title">
            <b>● LIVE DEALS</b>

            <span>{rankedProducts.length} found</span>
          </div>

          <section className="cards live-cards">
            {rankedProducts.map((product, index) => (
              <article
                key={`${product.title}-${index}`}
                className={
                  index === 0 ? "top-product" : ""
                }
              >
                <i>#{index + 1}</i>

                {product.thumbnail ? (
                  <img
                    src={product.thumbnail}
                    alt={product.title || "Product"}
                  />
                ) : (
                  <div className="card-placeholder">
                    <Sparkles />
                  </div>
                )}

                <div className="product-copy">
                  <b>{product.title || "Product"}</b>

                  <small>
                    {product.source || "Online store"}
                  </small>

                  <div className="product-meta">
                    {product.rating ? (
                      <span>
                        <Star
                          size={11}
                          fill="currentColor"
                        />
                        {product.rating}
                        {product.reviews
                          ? ` (${product.reviews})`
                          : ""}
                      </span>
                    ) : null}

                    {product.numericPrice !== null &&
                    bestDeal.numericPrice !== null &&
                    product.numericPrice <=
                      bestDeal.numericPrice * 1.1 ? (
                      <span className="good-price">
                        <TrendingDown size={11} />
                        Competitive price
                      </span>
                    ) : null}
                  </div>
                </div>

                <aside>
                  <b>{formatPrice(product)}</b>

                  <small>
                    WANT SCORE {product.wantScore}
                  </small>

                  <div className="mini-actions">
                    <button
                      aria-label="Track price"
                      onClick={() =>
                        toggleTrack(product)
                      }
                    >
                      <Heart
                        size={14}
                        fill={
                          isTracked(product)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>

                    <button
                      aria-label="View deal"
                      disabled={!productUrl(product)}
                      onClick={() => openDeal(product)}
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </aside>
              </article>
            ))}
          </section>
        </>
      )}

      {bestDeal && (
        <section className="insight">
          <div>
            <label>
              <Sparkles size={13} />
              AI INSIGHT
            </label>

            <h2>
              WANT recommends{" "}
              {bestDeal.title || "this deal"}.
            </h2>

            <p>
              This offer currently has the strongest
              combination of price, rating, reviews and
              seller information among the results found.
            </p>
          </div>

          <div className="score-circle">
            <strong>{bestDeal.wantScore}</strong>
            <small>WANT SCORE</small>
          </div>
        </section>
      )}

      {tracked.length > 0 && (
        <section className="tracking-summary">
          <Heart size={16} fill="currentColor" />

          <div>
            <b>
              {tracked.length}{" "}
              {tracked.length === 1
                ? "product"
                : "products"}{" "}
              tracked
            </b>

            <small>
              Price alerts will be connected in the next
              step.
            </small>
          </div>
        </section>
      )}

      <nav>
        {[
          ["Home", Home],
          ["Wishes", Heart],
          ["AI", Sparkles],
          ["Community", Users],
          ["Profile", User],
        ].map(([name, Icon]: any) => (
          <button
            className={tab === name ? "active" : ""}
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
