"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  Check,
  Cloud,
  ExternalLink,
  Heart,
  Home,
  LoaderCircle,
  Search,
  Sparkles,
  Star,
  TrendingDown,
  User,
  Users,
} from "lucide-react";

type Deal = {
  id: string;
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
  badges: string[];
  possibleMismatch: boolean;
  trustedSeller: boolean;
  priceConfidence: "normal" | "low" | "high";
};

type SearchResponse = {
  query: string;
  bestDeal: Deal | null;
  products: Deal[];
  totalFound: number;
  analyzedOffers: number;
  medianPrice: number | null;
  error?: string;
};

type Wish = Deal & {
  wishId: string;
  query: string;
  addedAt: string;
  lastCheckedAt: string;
  initialPrice: number;
  currentPrice: number;
  priceHistory: Array<{
    date: string;
    price: number;
  }>;
};

type WishesResponse = {
  wishes?: Wish[];
  wish?: Wish;
  error?: string;
};

const DEVICE_STORAGE_KEY = "want.device.id";

function formatPrice(price: number | null | undefined) {
  if (typeof price !== "number") return "—";

  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(price);
}

function openDeal(link?: string) {
  if (!link) return;

  window.open(link, "_blank", "noopener,noreferrer");
}

function getOrCreateDeviceId() {
  const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);

  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(DEVICE_STORAGE_KEY, id);

  return id;
}

export default function Page() {
  const [tab, setTab] = useState("AI");
  const [query, setQuery] = useState("");
  const [lastSearch, setLastSearch] = useState("");
  const [products, setProducts] = useState<Deal[]>([]);
  const [bestDeal, setBestDeal] = useState<Deal | null>(null);
  const [analyzedOffers, setAnalyzedOffers] = useState(0);
  const [medianPrice, setMedianPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "loading" | "saving" | "ready" | "error"
  >("idle");
  const [syncMessage, setSyncMessage] = useState("Cloud sync ready");

  const savedDealIds = useMemo(
    () => new Set(wishes.map((wish) => wish.id)),
    [wishes]
  );

  const trackedValue = wishes.reduce((sum, wish) => sum + wish.currentPrice, 0);
  const bestSavedScore = wishes.reduce(
    (score, wish) => Math.max(score, wish.wantScore),
    0
  );

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    loadWishes(deviceId);
  }, [deviceId]);

  async function loadWishes(id: string) {
    setSyncStatus("loading");
    setSyncMessage("Loading Wishes from Supabase...");

    try {
      const response = await fetch(`/api/wishes?deviceId=${encodeURIComponent(id)}`);
      const data: WishesResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load Wishes");
      }

      setWishes(Array.isArray(data.wishes) ? data.wishes : []);
      setSyncStatus("ready");
      setSyncMessage("Wishes synced with Supabase");
    } catch (err) {
      console.error(err);
      setSyncStatus("error");
      setSyncMessage("Supabase sync needs setup");
    }
  }

  async function handleSearch() {
    const cleanQuery = query.trim();

    if (!cleanQuery || loading) return;

    setLoading(true);
    setError("");
    setProducts([]);
    setBestDeal(null);
    setLastSearch(cleanQuery);
    setAnalyzedOffers(0);
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
      setAnalyzedOffers(data.analyzedOffers || data.totalFound || 0);
      setMedianPrice(
        typeof data.medianPrice === "number" ? data.medianPrice : null
      );
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function trackDeal(deal: Deal) {
    if (!deviceId || syncStatus === "saving") return;

    const existing = wishes.find((wish) => wish.id === deal.id);

    if (existing) {
      await removeWish(existing.wishId);
      return;
    }

    setSyncStatus("saving");
    setSyncMessage("Saving to Supabase...");

    try {
      const response = await fetch("/api/wishes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId,
          query: lastSearch || query || deal.title,
          deal,
        }),
      });

      const data: WishesResponse = await response.json();

      if (!response.ok || !data.wish) {
        throw new Error(data.error || "Failed to save Wish");
      }

      setWishes((current) => [
        data.wish!,
        ...current.filter((wish) => wish.id !== data.wish!.id),
      ]);

      setTab("Wishes");
      setSyncStatus("ready");
      setSyncMessage("Saved to Supabase");
    } catch (err) {
      console.error(err);
      setSyncStatus("error");
      setSyncMessage("Could not save Wish");
    }
  }

  async function removeWish(wishId: string) {
    if (!deviceId || syncStatus === "saving") return;

    const previous = wishes;

    setWishes((current) => current.filter((wish) => wish.wishId !== wishId));
    setSyncStatus("saving");
    setSyncMessage("Removing from Supabase...");

    try {
      const response = await fetch(
        `/api/wishes/${encodeURIComponent(wishId)}?deviceId=${encodeURIComponent(
          deviceId
        )}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove Wish");
      }

      setSyncStatus("ready");
      setSyncMessage("Wishes synced with Supabase");
    } catch (err) {
      console.error(err);
      setWishes(previous);
      setSyncStatus("error");
      setSyncMessage("Could not remove Wish");
    }
  }

  function isTracked(deal: Deal) {
    return savedDealIds.has(deal.id);
  }

  function DealBadges({ deal }: { deal: Deal }) {
    return (
      <div className="badge-row">
        {deal.badges.map((badge) => (
          <span
            className={
              badge === "POSSIBLE MISMATCH" ? "badge warning" : "badge"
            }
            key={`${deal.id}-${badge}`}
          >
            {badge}
          </span>
        ))}
      </div>
    );
  }

  function DealImage({ deal }: { deal: Pick<Deal, "thumbnail" | "title"> }) {
    if (deal.thumbnail) {
      return <img src={deal.thumbnail} alt={deal.title} loading="lazy" />;
    }

    return (
      <div className="product-placeholder">
        <Sparkles />
      </div>
    );
  }

  function SyncPill() {
    return (
      <div className={`sync-pill ${syncStatus === "error" ? "warning" : ""}`}>
        {syncStatus === "loading" || syncStatus === "saving" ? (
          <LoaderCircle size={13} className="spin" />
        ) : (
          <Cloud size={13} />
        )}

        <span>{syncMessage}</span>
      </div>
    );
  }

  function SearchView() {
    return (
      <>
        <section className="hero">
          <label>
            <Sparkles size={14} />
            YOUR SHOPPING COPILOT
          </label>

          <h1>
            What do you <em>want?</em>
          </h1>

          <p>
            Enter a product name. WANT searches live shopping offers, scores
            product match, seller trust and price quality, then saves tracked
            Wishes to Supabase.
          </p>

          <div className="ask">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSearch();
              }}
              placeholder='Try "AirPods Pro 3"'
            />

            <button
              onClick={handleSearch}
              disabled={!query.trim() || loading}
              aria-label="Search products"
            >
              {loading ? <LoaderCircle className="spin" /> : <ArrowRight />}
            </button>
          </div>

          <SyncPill />
        </section>

        {loading && (
          <section className="search-result">
            <small>
              <LoaderCircle size={13} className="spin" />
              WANT IS SEARCHING
            </small>

            <strong>{lastSearch}</strong>

            <p>Filtering accessories, checking match quality and ranking offers.</p>
          </section>
        )}

        {error && (
          <section className="search-result">
            <small>SEARCH ERROR</small>
            <strong>{error}</strong>
            <p>Please try the search again.</p>
          </section>
        )}

        {!loading && !error && lastSearch && products.length === 0 && (
          <section className="search-result">
            <small>NO RELIABLE DEALS</small>
            <strong>{lastSearch}</strong>
            <p>Try using the exact product model, brand and storage/size variant.</p>
          </section>
        )}

        {bestDeal && (
          <section className="best-deal">
            <div className="best-label">
              <Sparkles size={13} />
              BEST DEAL
            </div>

            <div className="best-content">
              <DealImage deal={bestDeal} />

              <div className="best-info">
                <h2>{bestDeal.title}</h2>
                <p>Found at {bestDeal.source}</p>
                <DealBadges deal={bestDeal} />

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
                <strong>{formatPrice(bestDeal.price)}</strong>
                <span>WANT SCORE {bestDeal.wantScore}</span>
              </aside>
            </div>

            <div className="best-actions">
              <button className="track-button" onClick={() => trackDeal(bestDeal)}>
                <Heart
                  size={16}
                  fill={isTracked(bestDeal) ? "currentColor" : "none"}
                />
                {isTracked(bestDeal) ? "Saved to Wishes" : "Track price"}
              </button>

              <button
                className="deal-button"
                disabled={!bestDeal.link}
                onClick={() => openDeal(bestDeal.link)}
              >
                View deal
                <ExternalLink size={15} />
              </button>
            </div>
          </section>
        )}

        {products.length > 0 && (
          <>
            <section className="stats">
              <div>
                <b>{analyzedOffers}</b>
                <span>Offers checked</span>
              </div>

              <div>
                <b>{products.length}</b>
                <span>Deals ranked</span>
              </div>

              <div>
                <b>{formatPrice(medianPrice)}</b>
                <span>Market median</span>
              </div>
            </section>

            <div className="title">
              <b>● LIVE DEALS</b>
              <span>{products.length} shown</span>
            </div>

            <section className="cards live-cards">
              {products.map((product, index) => (
                <article
                  key={product.id}
                  className={index === 0 ? "top-product" : ""}
                >
                  <i>#{index + 1}</i>

                  <DealImage deal={product} />

                  <div className="product-copy">
                    <b>{product.title}</b>
                    <small>{product.source}</small>

                    <DealBadges deal={product} />

                    <div className="product-meta">
                      {product.rating ? (
                        <span>
                          <Star size={11} fill="currentColor" />
                          {product.rating}
                          {product.reviews ? ` (${product.reviews})` : ""}
                        </span>
                      ) : null}

                      {product.priceScore >= 82 ? (
                        <span className="good-price">
                          <TrendingDown size={11} />
                          Strong price
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <aside>
                    <b>{formatPrice(product.price)}</b>
                    <small>WANT SCORE {product.wantScore}</small>

                    <div className="mini-actions">
                      <button
                        aria-label="Track price"
                        onClick={() => trackDeal(product)}
                      >
                        <Heart
                          size={14}
                          fill={isTracked(product) ? "currentColor" : "none"}
                        />
                      </button>

                      <button
                        aria-label="View deal"
                        disabled={!product.link}
                        onClick={() => openDeal(product.link)}
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

              <h2>WANT recommends this as the strongest current deal.</h2>

              <p>
                The score combines product matching, seller trust, price quality,
                ratings and review signals. Saving now creates a price-history
                row in Supabase.
              </p>
            </div>

            <div className="score-circle">
              <strong>{bestDeal.wantScore}</strong>
              <small>WANT SCORE</small>
            </div>
          </section>
        )}
      </>
    );
  }

  function WishesView() {
    return (
      <>
        <section className="hero compact">
          <label>
            <Heart size={14} />
            SAVED WISHES
          </label>

          <h1>
            Price <em>tracking.</em>
          </h1>

          <p>
            Saved deals now sync to Supabase with their first observed price,
            current price and tracking-ready price history.
          </p>

          <SyncPill />
        </section>

        <section className="stats">
          <div>
            <b>{wishes.length}</b>
            <span>Wishes saved</span>
          </div>

          <div>
            <b>{formatPrice(trackedValue)}</b>
            <span>Tracked value</span>
          </div>

          <div>
            <b>{bestSavedScore || "—"}</b>
            <span>Best score</span>
          </div>
        </section>

        {wishes.length === 0 ? (
          <section className="empty-state">
            <Sparkles />
            <b>No wishes yet</b>
            <p>Search a product and tap Track price to save it to Supabase.</p>
          </section>
        ) : (
          <section className="cards live-cards wish-cards">
            {wishes.map((wish) => {
              const delta = wish.currentPrice - wish.initialPrice;

              return (
                <article key={wish.wishId}>
                  <i>{wish.priceHistory.length}</i>

                  <DealImage deal={wish} />

                  <div className="product-copy">
                    <b>{wish.title}</b>
                    <small>{wish.source}</small>
                    <DealBadges deal={wish} />

                    <div className="price-history">
                      <span>
                        Added {new Date(wish.addedAt).toLocaleDateString()}
                      </span>
                      <span>
                        {delta === 0
                          ? "No price change yet"
                          : `${delta > 0 ? "+" : ""}${formatPrice(delta)}`}
                      </span>
                    </div>
                  </div>

                  <aside>
                    <b>{formatPrice(wish.currentPrice)}</b>
                    <small>SYNCED</small>

                    <div className="mini-actions">
                      <button
                        aria-label="View deal"
                        disabled={!wish.link}
                        onClick={() => openDeal(wish.link)}
                      >
                        <ExternalLink size={14} />
                      </button>

                      <button
                        aria-label="Remove wish"
                        onClick={() => removeWish(wish.wishId)}
                      >
                        <Heart size={14} fill="currentColor" />
                      </button>
                    </div>
                  </aside>
                </article>
              );
            })}
          </section>
        )}
      </>
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
          <button aria-label="Search" onClick={() => setTab("AI")}>
            <Search />
          </button>

          <button aria-label="Notifications">
            <Bell />
          </button>
        </div>
      </header>

      {tab === "Wishes" ? <WishesView /> : <SearchView />}

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
