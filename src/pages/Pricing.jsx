import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import "../styles/Pricing.css";

const FREE_STORAGE_BYTES = 1024 * 1024 * 1024;

const FREE_FEATURES = [
  "5 Forms",
  "50 Submissions",
  "1 GB File Storage",
  "Email Notifications",
  "File Upload",
  "Redirections",
  "Share Form",
  "Webhooks",
  "Slack Webhook",
  "Discord Webhook",
  "Export CSV",
  "Zapier",
  "Built-in Validations",
  "Spam Protection",
];

const PRO_FEATURES = [
  "15 Forms",
  "10K Submissions",
  "5 GB File Storage",
];

const PRO_EXTRA = [
  "Autoresponder",
  "5 Workspaces",
  "Custom Email Sender",
  "Remove CS Formly branding",
];

const BUSINESS_FEATURES = [
  "Unlimited Forms",
  "50K Submissions",
  "10 GB File Storage",
];

const BUSINESS_EXTRA = ["Workspace (15 members)"];

function CheckIcon() {
  return (
    <svg className="pricing-features__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function PlanIcon({ variant }) {
  // Simple inline icons (no extra deps) to match the template feel.
  if (variant === "basic") {
    return (
      <svg className="pricing-plan-icon pricing-plan-icon--basic" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2l2.4 5.5 6 .6-4.5 3.9 1.4 5.8L12 15.9 6.7 17.8l1.4-5.8L3.6 8.1l6-.6L12 2z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (variant === "business") {
    return (
      <svg className="pricing-plan-icon pricing-plan-icon--business" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M20 7h-3V6a3 3 0 0 0-3-3H10a3 3 0 0 0-3 3v1H4a2 2 0 0 0-2 2v3a3 3 0 0 0 3 3h1v4h12v-4h1a3 3 0 0 0 3-3V9a2 2 0 0 0-2-2zM9 6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9V6zm7 15H8v-5h8v5z"
          fill="currentColor"
        />
      </svg>
    );
  }
  // professional/pro
  return (
    <svg className="pricing-plan-icon pricing-plan-icon--pro" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 7h10V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2zm-2 2h14a2 2 0 0 1 2 2v2a3 3 0 0 1-3 3h-1v4H7v-4H6a3 3 0 0 1-3-3v-2a2 2 0 0 1 2-2zm4 11h6v-2H9v2z"
        fill="currentColor"
      />
    </svg>
  );
}

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${Math.round(n)} B`;
}

export default function Pricing() {
  const { userMeta, refreshProfile, applyAuthUpdate } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [usageSnap, setUsageSnap] = useState(null);
  const completedSessionRef = useRef(new Set());

  const current = userMeta?.subscriptionPlan || (userMeta ? "free" : null);
  const effectiveUsageMaxStorage =
    usageSnap?.limits?.maxStorageBytes == null
      ? null
      : (current || "free").toLowerCase() === "free"
        ? Math.max(usageSnap.limits.maxStorageBytes, FREE_STORAGE_BYTES)
        : usageSnap.limits.maxStorageBytes;

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    fetch("/api/billing/usage", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsageSnap)
      .catch(() => setUsageSnap(null));
  }, [current]);

  useEffect(() => {
    if (searchParams.get("canceled") === "1") {
      toast("Checkout canceled", { icon: "ℹ️" });
      const next = new URLSearchParams(searchParams);
      next.delete("canceled");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const success = searchParams.get("success");
    const sid = searchParams.get("session_id");
    if (success !== "1" || !sid) return;
    if (completedSessionRef.current.has(sid)) return;
    completedSessionRef.current.add(sid);

    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(
          `/api/billing/complete-session?session_id=${encodeURIComponent(sid)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Could not confirm subscription");
        }
        if (cancelled) return;
        // Apply updated plan immediately (no logout/login needed).
        applyAuthUpdate?.(data);
        // Best-effort refresh in background (don't await to avoid delay)
        refreshProfile().catch(() => {});
        // update limits
        fetch("/api/billing/usage", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((snap) => snap && setUsageSnap(snap));

        toast.success("Payment successful. Your plan is updated.");
        const next = new URLSearchParams(searchParams);
        next.delete("success");
        next.delete("session_id");
        setSearchParams(next, { replace: true });
      } catch (e) {
        if (!cancelled) toast.error(e.message || "Confirmation failed");
      }
    })();

    return () => {
      cancelled = true;
      completedSessionRef.current.delete(sid);
    };
  }, [searchParams, setSearchParams, refreshProfile, applyAuthUpdate]);

  const startCheckout = async (plan) => {
    setCheckoutLoading(plan);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("Please log in to choose a plan");
        return;
      }
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not start checkout");
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (e) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="pricing-page pricing-noble">
      <div className="pricing-noble__content">
        <header className="pricing-noble__header">
          <h2 className="pricing-noble__title">Choose a plan</h2>
          <p className="pricing-noble__subtitle">
            Limits apply to your whole account (all forms and folders). Upgrade for higher caps. Checkout is powered by Stripe.
          </p>

          {usageSnap && (
            <div className="pricing-noble__usageWrap">
              <p className="pricing-noble__usage">
                <strong>Your usage:</strong>{" "}
                {usageSnap.usage.forms}
                {usageSnap.limits.maxForms != null ? ` / ${usageSnap.limits.maxForms}` : ""} forms ·{" "}
                {usageSnap.usage.submissions.toLocaleString()}
                {usageSnap.limits.maxSubmissions != null
                  ? ` / ${usageSnap.limits.maxSubmissions.toLocaleString()}`
                  : ""}{" "}
                submissions · {formatBytes(usageSnap.usage.storageBytes)}
                {effectiveUsageMaxStorage != null ? ` / ${formatBytes(effectiveUsageMaxStorage)}` : ""} storage ·{" "}
                {usageSnap.usage.folders}
                {usageSnap.limits.maxFolders != null ? ` / ${usageSnap.limits.maxFolders}` : ""} folders
              </p>
            </div>
          )}
        </header>

        <div className="pricing-noble__container">
          <div className="pricing-noble__grid">
            {/* Free plan */}
            <section className={`pricing-card ${current === "free" ? "pricing-card--active" : ""}`}>
              <div className="pricing-card__body">
                <h4 className="pricing-card__name">Free</h4>
                <PlanIcon variant="basic" />
                <h1 className="pricing-card__price">$0</h1>
                <p className="pricing-card__billing">No card required</p>


                <ul className="pricing-card__features">
                  {FREE_FEATURES.map((f) => (
                    <li key={f} className="pricing-card__feature">
                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="pricing-card__cta">
                  <button
                    type="button"
                    className={`pricing-card__btn ${current === "free" ? "pricing-card__btn--muted" : "pricing-card__btn--primary"}`}
                    onClick={() => {
                      if (current === "free") toast.success("You're on the Free plan.");
                      else if (current) toast.info("Please contact support to downgrade your plan.");
                      else toast.info("Please sign up to get started.");
                    }}
                    disabled={current === "free" || current === "pro" || current === "business"}
                  >
                    {current === "free" ? "Current plan" : "Get started"}
                  </button>
                </div>

                {current === "free" && <span className="pricing-card__badge">Current</span>}
              </div>
            </section>

            {/* Pro plan */}
            <section className={`pricing-card ${current === "pro" ? "pricing-card--active" : ""}`}>
              <div className="pricing-card__body">
                <h4 className="pricing-card__name">Pro</h4>
                <PlanIcon variant="pro" />
                <h1 className="pricing-card__price">$15.83</h1>
                <p className="pricing-card__billing">per month · billed yearly</p>

                <ul className="pricing-card__features">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="pricing-card__feature">
                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                  <li className="pricing-card__feature pricing-card__feature--section">Everything in Free plus</li>
                  {PRO_EXTRA.map((f) => (
                    <li key={f} className="pricing-card__feature">
                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="pricing-card__cta">
                  <button
                    type="button"
                    className="pricing-card__btn pricing-card__btn--success"
                    onClick={() => startCheckout("pro")}
                    disabled={checkoutLoading === "pro" || current === "pro" || current === "business"}
                  >
                    {checkoutLoading === "pro" ? "Redirecting…" : current === "pro" ? "Current plan" : "Get started"}
                  </button>
                </div>

                {current === "pro" && <span className="pricing-card__badge">Current</span>}
              </div>
            </section>

            {/* Business plan */}
            <section className={`pricing-card ${current === "business" ? "pricing-card--active" : ""}`}>
              <div className="pricing-card__body">
                <h4 className="pricing-card__name">Business</h4>
                <PlanIcon variant="business" />
                <h1 className="pricing-card__price">$40.83</h1>
                <p className="pricing-card__billing">per month · billed yearly</p>


                <ul className="pricing-card__features">
                  {BUSINESS_FEATURES.map((f) => (
                    <li key={f} className="pricing-card__feature">
                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                  <li className="pricing-card__feature pricing-card__feature--section">Everything in Pro plus</li>
                  {BUSINESS_EXTRA.map((f) => (
                    <li key={f} className="pricing-card__feature">

                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="pricing-card__cta">
                  <button
                    type="button"
                    className="pricing-card__btn pricing-card__btn--primary"
                    onClick={() => startCheckout("business")}
                    disabled={checkoutLoading === "business" || current === "business"}
                  >
                    {checkoutLoading === "business" ? "Redirecting…" : current === "business" ? "Current plan" : "Get started"}
                  </button>
                </div>

                {current === "business" && <span className="pricing-card__badge">Current</span>}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
