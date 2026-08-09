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
  Check,
  ExternalLink,
} from "lucide-react";

type Product = {
  title: string;
  price: number | null;
  displayPrice?: string | null;
  source: string;
  thumbnail: string | null;
  link: string | null;
  matchScore: number;
  accessory: boolean;
  exactModelMatch: boolean;
  withinBudget: boolean | null;
};

type SearchResponse = {
  query: string;
  searchQuery: string;
  budget: number | null;
  totalResults: number;
  filteredResults: number;
  exactMatchWithinBudget: boolean;
  bestMatch: Product | null;
  products: Product[];
  error?: string;
};

export default function Page() {
  const [tab, setTab] = useState("Home");
  const [query, setQuery] = useState("");

  const [status, setStatus] = useState<
    "idle" | "searching" | "success" | "empty" | "error"
  >("idle");

  const [lastSearch, setLastSearch] = useState("");
  const [result, setResult] =
    useState<SearchResponse | null>(null);

  async function handleSearch() {
    const cleanQuery = query.trim();

    if (!cleanQuery || status === "searching") return;

    setLastSearch(cleanQuery);
    setStatus("searching");
    setResult(null);

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

      setResult(data);

      if (!data.products?.length) {
        setStatus("empty");
      } else {
        setStatus("success");
      }
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  }

  function formatPrice(product: Product) {
    if (typeof product.price === "number") {
      return `€${product.price.toFixed(2)}`;
    }

    return product.displayPrice || "See price";
  }

  function openProduct(product: Product) {
    if (!product.link) return;

    window.open(
      product.link,
      "_blank",
      "noopener,noreferrer"
    );
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
          Tell WANT. what you're looking for. AI searches live
          shopping results, compares prices and finds the best
          option for your budget.
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
            placeholder='Try “AirPods Pro 3 under €200”'
          />

          <button
            onClick={handleSearch}
            disabled={
              !query.trim() || status === "searching"
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
            <small>WANT IS SEARCHING</small>

            <strong>{lastSearch}</strong>

            <p>
              Checking live products, filtering accessories and
              comparing prices...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="search-result">
            <small>SEARCH ERROR</small>

            <strong>Something went wrong.</strong>

            <p>
              Please try the search again.
            </p>
          </div>
        )}

        {status === "empty" && (
          <div className="search-result">
            <small>NO GOOD MATCH</small>

            <strong>{lastSearch}</strong>

            <p>
              WANT couldn't find a reliable product match. Try
              adding the brand or exact model.
            </p>
          </div>
        )}
      </section>

      {status === "success" && result && (
        <>
          {result.bestMatch && (
            <section className="insight">
              <div>
                <label>
                  <Sparkles size={13} />
                  BEST MATCH
                </label>

                <h2>{result.bestMatch.title}</h2>

                <p>
                  Found at {result.bestMatch.source}
                  {result.budget !== null &&
                    result.bestMatch.withinBudget &&
                    ` · Within your €${result.budget} budget`}
                </p>
              </div>

              <button
                onClick={() =>
                  openProduct(result.bestMatch!)
                }
                disabled={!result.bestMatch.link}
              >
                {formatPrice(result.bestMatch)}
                <ExternalLink size={15} />
              </button>
            </section>
          )}

          {result.budget !== null &&
            !result.exactMatchWithinBudget && (
              <section className="search-result">
                <small>PRICE ALERT</small>

                <strong>
                  No exact match found under €
                  {result.budget}
                </strong>

                <p>
                  These are the closest relevant live offers WANT
                  found.
                </p>
              </section>
            )}

          <div className="title">
            <b>● LIVE DEALS</b>
            <span>{result.products.length} found</span>
          </div>

          <section className="cards">
            {result.products.map((product, i) => (
              <article
                key={`${product.title}-${i}`}
                onClick={() => openProduct(product)}
                style={{
                  cursor: product.link
                    ? "pointer"
                    : "default",
                }}
              >
                <i>#{i + 1}</i>

                {product.thumbnail ? (
                  <img
                    src={product.thumbnail}
                    alt={product.title}
                    style={{
                      width: 76,
                      height: 76,
                      objectFit: "contain",
                      borderRadius: 12,
                      background: "#fff",
                    }}
                  />
                ) : (
                  <strong>✨</strong>
                )}

                <div>
                  <b>{product.title}</b>

                  <small>
                    {product.source}

                    {product.withinBudget && (
                      <>
                        {" "}
                        · <u>IN BUDGET</u>
                      </>
                    )}
                  </small>
                </div>

                <aside>
                  <b>{formatPrice(product)}</b>

                  <small>
                    {product.exactModelMatch
                      ? "BEST MATCH"
                      : `MATCH ${Math.max(
                          0,
                          product.matchScore
                        )}`}
                  </small>
                </aside>
              </article>
            ))}
          </section>
        </>
      )}

      {status === "idle" && (
        <>
          <section className="stats">
            <div>
              <b>0</b>
              <span>Wishes tracked</span>
            </div>

            <div>
              <b>0</b>
              <span>Targets hit</span>
            </div>

            <div>
              <b>—</b>
              <span>Potential savings</span>
            </div>
          </section>

          <div className="title">
            <b>● AI TOP PICKS</b>
            <span>Start searching</span>
          </div>
        </>
      )}

      {status === "success" && result?.bestMatch && (
        <section className="community">
          <b>
            <Check size={22} />
          </b>

          <div>
            <b>
              {result.exactMatchWithinBudget
                ? "Target found"
                : "Closest match found"}
            </b>

            <small>
              WANT analyzed {result.totalResults} shopping
              results
            </small>
          </div>

          <button
            onClick={() =>
              openProduct(result.bestMatch!)
            }
          >
            <ArrowRight size={18} />
          </button>
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
