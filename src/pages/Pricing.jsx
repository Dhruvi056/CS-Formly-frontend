import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import "../styles/Pricing.css";

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

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${Math.round(n)} B`;
}

export default function Pricing() {
  const { userMeta, refreshProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [usageSnap, setUsageSnap] = useState(null);
  const completedSessionRef = useRef(new Set());

  const current = userMeta?.subscriptionPlan || "free";

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
        await refreshProfile();
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
    };
  }, [searchParams, setSearchParams, refreshProfile]);

  const startCheckout = async (plan) => {
    setCheckoutLoading(plan);
    try {
      const token = localStorage.getItem("authToken");
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
    <div className="pricing-page">
      <div className="pricing-page--dark">
        <h1 className="pricing-page__title">Choose your plan</h1>
        <p className="pricing-page__subtitle">
          Limits apply to your whole account (all forms and folders). Upgrade for higher caps. Checkout is powered by Stripe.
        </p>

        {usageSnap && (
          <p className="pricing-page__usage">
            <strong>Your usage:</strong>{" "}
            {usageSnap.usage.forms}
            {usageSnap.limits.maxForms != null ? ` / ${usageSnap.limits.maxForms}` : ""} forms ·{" "}
            {usageSnap.usage.submissions.toLocaleString()}
            {usageSnap.limits.maxSubmissions != null
              ? ` / ${usageSnap.limits.maxSubmissions.toLocaleString()}`
              : ""}{" "}
            submissions · {formatBytes(usageSnap.usage.storageBytes)}
            {usageSnap.limits.maxStorageBytes != null
              ? ` / ${formatBytes(usageSnap.limits.maxStorageBytes)}`
              : ""}{" "}
            storage · {usageSnap.usage.folders}
            {usageSnap.limits.maxFolders != null ? ` / ${usageSnap.limits.maxFolders}` : ""} folders
          </p>
        )}

        <div className="pricing-grid">
          {/* Free (reference: former &quot;Pro&quot; column features, $0) */}
          <div className="pricing-col">
            <div className="pricing-col__head">
              <div className="pricing-col__icon pricing-col__icon--free" aria-hidden>
                ⚡
              </div>
              <div>
                <h2 className="pricing-col__name">Free</h2>
                <div className="pricing-col__tag">Starter</div>
              </div>
            </div>
            <p className="pricing-col__desc">Perfect for personal projects and websites.</p>
            <div className="pricing-col__price">$0</div>
            <div className="pricing-col__billing">No card required</div>
            <button
              type="button"
              className="pricing-col__btn pricing-col__btn--muted"
              onClick={() => toast.success("You're on the Free plan.")}
              disabled={current === "free"}
            >
              {current === "free" ? "Current plan" : "Get started"}
            </button>
            <ul className="pricing-features">
              {FREE_FEATURES.map((f) => (
                <li key={f}>
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {current === "free" && <span className="pricing-badge-current">Current</span>}
          </div>

          {/* Pro (reference: former &quot;Business&quot; column) */}
          <div className="pricing-col pro">
            <div className="pricing-col__head">
              <div className="pricing-col__icon pricing-col__icon--pro" aria-hidden>
                🤖
              </div>
              <div>
                <h2 className="pricing-col__name">Pro</h2>
                <div className="pricing-col__tag">Scale with your team</div>
              </div>
            </div>
            <p className="pricing-col__desc">Scale your forms with your team.</p>
            <div className="pricing-col__price">$15.83</div>
            <div className="pricing-col__billing">per month · billed yearly</div>
            <button
              type="button"
              className="pricing-col__btn pricing-col__btn--accent"
              onClick={() => startCheckout("pro")}
              disabled={checkoutLoading === "pro" || current === "pro"}
            >
              {checkoutLoading === "pro"
                ? "Redirecting…"
                : current === "pro"
                  ? "Current plan"
                  : "Get started"}
            </button>
            <ul className="pricing-features">
              {PRO_FEATURES.map((f) => (
                <li key={f}>
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
              <li className="pricing-features__section">Everything in Free plus</li>
              {PRO_EXTRA.map((f) => (
                <li key={f}>
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {current === "pro" && <span className="pricing-badge-current">Current</span>}
          </div>

          {/* Business (reference: former &quot;Volume&quot; column) */}
          <div className="pricing-col">
            <div className="pricing-col__head">
              <div className="pricing-col__icon pricing-col__icon--biz" aria-hidden>
                🚀
              </div>
              <div>
                <h2 className="pricing-col__name">Business</h2>
                <div className="pricing-col__tag">High volume</div>
              </div>
            </div>
            <p className="pricing-col__desc">Built for high-volume forms.</p>
            <div className="pricing-col__price">$40.83</div>
            <div className="pricing-col__billing">per month · billed yearly</div>
            <button
              type="button"
              className="pricing-col__btn pricing-col__btn--accent"
              onClick={() => startCheckout("business")}
              disabled={checkoutLoading === "business" || current === "business"}
            >
              {checkoutLoading === "business"
                ? "Redirecting…"
                : current === "business"
                  ? "Current plan"
                  : "Get started"}
            </button>
            <ul className="pricing-features">
              {BUSINESS_FEATURES.map((f) => (
                <li key={f}>
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
              <li className="pricing-features__section">Everything in Pro plus</li>
              {BUSINESS_EXTRA.map((f) => (
                <li key={f}>
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {current === "business" && <span className="pricing-badge-current">Current</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
