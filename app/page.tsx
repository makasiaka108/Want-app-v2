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
  ArrowRight,
  LoaderCircle,
  ExternalLink,
  Star,
  Check,
} from "lucide-react";

type Product = {
  title: string;
  price: number;
  source: string;
  link: string;
  thumbnail: string;
  rating?: number | null;
  reviews?: number | null;
  delivery?: string;
  matchScore?: number;
  wantScore?: number;
};

type SearchResponse = {
  query: string;
  bestDeal: Product | null;
  products: Product[];
  totalFound: number;
  medianPrice?: number | null;
  error?: string;
};

export default function Page() {
  const [tab, setTab] = useState("Home");
  const [query, setQuery] = useState("");

  const [status, setStatus] = useState<
    "idle" | "searching" | "success" | "error"
  >("idle");

  const [searchedQuery, setSearchedQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [bestDeal, setBestDeal] = useState<Product | null>(null);
  const [totalFound, setTotalFound] = useState(0);
  const [medianPrice, setMedianPrice] = useState<number | null>(null);
  const [error, setError] = useState("");

  function formatPrice(price?: number | null) {
    if (typeof price !== "number") return "—";

    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }

  function openDeal(link?: string) {
    if (!link) return;

    window.open(link, "_blank", "noopener,noreferrer");
  }

  async function handleSearch() {
    const cleanQuery = query.trim();

    if (!cleanQuery || status === "searching") return;

    setStatus("searching");
    setSearchedQuery(cleanQuery);
    setError("");
    setProducts([]);
    setBestDeal(null);
    setTotalFound(0);
    setMedianPrice(null);

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

      setProducts(Array.isArray(data.products) ? data.products : []);
      setBestDeal(data.bestDeal || null);
      setTotalFound(data.totalFound || 0);
      setMedianPrice(
        typeof data.medianPrice === "number"
          ? data.medianPrice
          : null
      );

      setStatus("success");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );

      setStatus("error");
    }
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
          Search for any product. WANT compares live shopping
          offers and finds the best deals for you.
        </p>

        <div className="ask">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            placeholder='Search a product — e.g. "AirPods Pro 3"'
          />

          <button
            onClick={handleSearch}
            disabled={!query.trim() || status === "searching"}
            aria-label="Search products"
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
              <LoaderCircle size={13} className="spin" />
              WANT IS SEARCHING
            </small>

            <strong>{searchedQuery}</strong>

            <p>
              Comparing live offers and filtering irrelevant
              products...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="search-result">
            <small>SEARCH ERROR</small>

            <strong>{searchedQuery}</strong>

            <p>{error}</p>
          </div>
        )}
      </section>

      {status === "success" && (
        <>
          <section className="stats">
            <div>
              <b>{totalFound}</b>
              <span>Offers found</span>
            </div>

            <div>
              <b>
                {bestDeal
                  ? formatPrice(bestDeal.price)
                  : "—"}
              </b>
              <span>Best price</span>
            </div>

            <div>
              <b>
                {medianPrice
                  ? formatPrice(medianPrice)
                  : "—"}
              </b>
              <span>Market price</span>
            </div>
          </section>

          {bestDeal ? (
            <section className="insight">
              <div>
                <label>
                  <Sparkles size={13} />
                  BEST DEAL
                </label>

                <h2>{bestDeal.title}</h2>

                <p>
                  Found at {bestDeal.source}
                  {bestDeal.wantScore
                    ? ` · WANT Score ${bestDeal.wantScore}`
                    : ""}
                </p>
              </div>

              <button
                onClick={() => openDeal(bestDeal.link)}
                disabled={!bestDeal.link}
              >
                {formatPrice(bestDeal.price)}
                <ExternalLink size={15} />
              </button>
            </section>
          ) : (
            <section className="insight">
              <div>
                <label>
                  <Sparkles size={13} />
                  NO RELIABLE DEAL
                </label>

                <h2>
                  We couldn't find a confident match.
                </h2>

                <p>
                  Try adding the brand or exact model name.
                </p>
              </div>
            </section>
          )}

          <div className="title">
            <b>● LIVE DEALS</b>
            <span>{products.length} shown</span>
          </div>

          <section className="cards">
            {products.map((product, i) => (
              <article
                key={`${product.title}-${product.source}-${i}`}
              >
                <i>#{i + 1}</i>

                <strong>
                  {product.thumbnail ? (
                    <img
                      src={product.thumbnail}
                      alt={product.title}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        borderRadius: "12px",
                        background: "white",
                      }}
                    />
                  ) : (
                    "✨"
                  )}
                </strong>

                <div>
                  <b>{product.title}</b>

                  <small>
                    {product.source}

                    {product.rating ? (
                      <>
                        {" "}
                        · <Star size={11} />
                        {product.rating}
                      </>
                    ) : null}
                  </small>

                  {product.delivery && (
                    <small>{product.delivery}</small>
                  )}
                </div>

                <aside>
                  <b>{formatPrice(product.price)}</b>

                  <small>
                    {i === 0
                      ? "BEST DEAL"
                      : product.wantScore
                      ? `WANT SCORE ${product.wantScore}`
                      : "VIEW DEAL"}
                  </small>

                  {product.link && (
                    <button
                      onClick={() =>
                        openDeal(product.link)
                      }
                      aria-label={`Open ${product.title}`}
                      style={{
                        background: "transparent",
                        border: 0,
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                </aside>
              </article>
            ))}
          </section>

          {products.length > 0 && (
            <section className="community">
              <b>
                <Check />
              </b>

              <div>
                <b>
                  WANT checked {totalFound} relevant offers
                </b>

                <small>
                  Irrelevant accessories, used products and
                  suspicious price outliers were filtered.
                </small>
              </div>
            </section>
          )}
        </>
      )}

      {status === "idle" && (
        <>
          <section className="stats">
            <div>
              <b>LIVE</b>
              <span>Product search</span>
            </div>

            <div>
              <b>PT</b>
              <span>Portugal market</span>
            </div>

            <div>
              <b>AI</b>
              <span>Deal ranking</span>
            </div>
          </section>

          <section className="insight">
            <div>
              <label>
                <Sparkles size={13} />
                HOW IT WORKS
              </label>

              <h2>Just tell WANT. what you want.</h2>

              <p>
                Search by product name. WANT finds offers,
                removes irrelevant results and ranks the best
                deals.
              </p>
            </div>
          </section>
        </>
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
