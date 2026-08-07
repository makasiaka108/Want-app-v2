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

export default function Page() {
  const [tab, setTab] = useState("Home");
  const [query, setQuery] = useState("");
  const [wishes, setWishes] = useState<Wish[]>(initialWishes);

  const [status, setStatus] = useState<
    "idle" | "searching" | "added"
  >("idle");

  const [lastSearch, setLastSearch] = useState("");

  function handleSearch() {
    const cleanQuery = query.trim();

    if (!cleanQuery || status === "searching") return;

    setLastSearch(cleanQuery);
    setStatus("searching");

    /*
      Пока здесь имитируется короткая обработка запроса.
      На следующем этапе вместо этого подключим API.
    */

    setTimeout(() => {
      const newWish: Wish = {
        name: cleanQuery,
        icon: "✨",
        custom: true,
      };

      setWishes((current) => [newWish, ...current]);

      setStatus("added");
      setQuery("");

      setTimeout(() => {
        setStatus("idle");
      }, 2500);
    }, 900);
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
            <small>WANT IS ANALYZING</small>

            <strong>{lastSearch}</strong>

            <p>
              Understanding the product, price target and shopping
              intent...
            </p>
          </div>
        )}

        {status === "added" && (
          <div className="search-result success">
            <small>
              <Check size={13} /> ADDED TO WISHES
            </small>

            <strong>{lastSearch}</strong>

            <p>
              Your request is now saved. Live product search will be
              connected next.
            </p>
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
          <article key={`${wish.name}-${i}`}>
            <i>#{i + 1}</i>

            <strong>{wish.icon}</strong>

            <div>
              <b>{wish.name}</b>

              {wish.custom ? (
                <small>Waiting for live product search</small>
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
                  <b>—</b>
                  <small>NEW WISH</small>
                </>
              ) : (
                <>
                  <b>€{wish.price}</b>
                  <small>WANT SCORE {wish.score}</small>
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

          <h2>Oakley is close to your target.</h2>

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
          <small>Trending products & shared deals</small>
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