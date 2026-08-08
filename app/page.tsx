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
} from "lucide-react";

type Wish = {
  name: string;
  price?: number;
  target?: number;
  discount?: number;
  score?: number;
  icon: string;
  custom?: boolean;
  link?: string;
  source?: string;
};

type SearchResult = {
  title?: string;
  name?: string;
  price?: number | string;
  extracted_price?: number;
  link?: string;
  product_link?: string;
  source?: string;
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

function parsePrice(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .replace(/\s/g, "")
    .replace(/[^\d,.]/g, "");

  if (!normalized) {
    return undefined;
  }

  let cleaned = normalized;

  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      cleaned = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    cleaned = normalized.replace(",", ".");
  }

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : undefined;
}

export default function Page() {
  const [tab, setTab] = useState("Home");
  const [query, setQuery] = useState("");
  const [wishes, setWishes] = useState<Wish[]>(initialWishes);

  const [status, setStatus] = useState<
    "idle" | "searching" | "added" | "error"
  >("idle");

  const [lastSearch, setLastSearch] = useState("");
  const [message, setMessage] = useState("");

  async function handleSearch() {
    const cleanQuery = query.trim();

    if (!cleanQuery || status === "searching") {
      return;
    }

    setLastSearch(cleanQuery);
    setStatus("searching");
    setMessage("");

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Product search failed."
        );
      }

      const products: SearchResult[] = Array.isArray(data?.products)
        ? data.products
        : [];

      if (products.length === 0) {
        throw new Error(
          "No matching products were found."
        );
      }

      const rawResult = products[0];

      const productName =
        rawResult.title ||
        rawResult.name ||
        cleanQuery;

      const productPrice =
        typeof rawResult.extracted_price === "number"
          ? rawResult.extracted_price
          : parsePrice(rawResult.price);

      const productLink =
        rawResult.product_link ||
        rawResult.link;

      const newWish: Wish = {
        name: productName,
        price: productPrice,
        icon: "✨",
        custom: true,
        link: productLink,
        source: rawResult.source,
      };

      setWishes((current) => [
        newWish,
        ...current,
      ]);

      setStatus("added");
      setQuery("");

      if (productPrice !== undefined) {
        setMessage(
          `Best result found for €${productPrice.toFixed(2)}.`
        );
      } else {
        setMessage(
          "Product found and added to your wishes."
        );
      }

      setTimeout(() => {
        setStatus("idle");
      }, 4000);
    } catch (error) {
      console.error("Search error:", error);

      setStatus("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while searching."
      );
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
          Tell WANT. what you're looking for. AI identifies the exact
          product, tracks the market and finds the right moment to buy.
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
            placeholder='Try “I want Oakley sunglasses under €120”'
          />

          <button
            onClick={handleSearch}
            disabled={!query.trim() || status === "searching"}
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
              Searching live shopping results and comparing available
              products...
            </p>
          </div>
        )}

        {status === "added" && (
          <div className="search-result success">
            <small>
              <Check size={13} /> PRODUCT FOUND
            </small>

            <strong>{lastSearch}</strong>

            <p>{message}</p>
          </div>
        )}

        {status === "error" && (
          <div className="search-result">
            <small>SEARCH ERROR</small>

            <strong>{lastSearch}</strong>

            <p>{message}</p>
          </div>
        )}
      </section>

      <section className="stats">
        <div>
          <b>{wishes.length}</b>
          <span>Wishes tracked</span>
        </div>

        <div>
          <b>0</b>
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
            onClick={() => {
              if (wish.link) {
                window.open(
                  wish.link,
                  "_blank",
                  "noopener,noreferrer"
                );
              }
            }}
            style={{
              cursor: wish.link ? "pointer" : "default",
            }}
          >
            <i>#{i + 1}</i>

            <strong>{wish.icon}</strong>

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
                    <TrendingDown size={12} />
                    {wish.discount}%
                  </u>
                </small>
              )}
            </div>

            <aside>
              {wish.custom ? (
                <>
                  <b>
                    {wish.price !== undefined
                      ? `€${wish.price.toFixed(2)}`
                      : "—"}
                  </b>

                  <small>
                    {wish.link
                      ? "VIEW DEAL"
                      : "LIVE RESULT"}
                  </small>
                </>
              ) : (
                <>
                  <b>€{wish.price}</b>

                  <small>
                    WANT SCORE {wish.score}
                  </small>
                </>
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

          <h2>
            Oakley is close to your target.
          </h2>

          <p>
            Current price is only €4 above target and near its
            90-day low.
          </p>
        </div>

        <button>
          Check deals
          <ArrowRight size={15} />
        </button>
      </section>

      <div className="title">
        <b>COMMUNITY TRENDING</b>
        <span>Explore</span>
      </div>

      <section className="community">
        <b>👤 👤 👤</b>

        <div>
          <b>1,284 people want this</b>

          <small>
            Trending products & shared deals
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
