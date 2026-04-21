import { useMemo } from "react";

function titleCasePlan(plan) {
  const p = String(plan || "free").toLowerCase();
  if (p === "pro") return "Pro";
  if (p === "business") return "Business";
  return "Free";
}

function PlanBadge({ plan }) {
  const p = String(plan || "free").toLowerCase();
  const cls =
    p === "business"
      ? "bg-warning-subtle text-warning"
      : p === "pro"
        ? "bg-primary-subtle text-primary"
        : "bg-success-subtle text-success";

  return (
    <span
      className={`badge ${cls} rounded-pill text-uppercase`}
      style={{ fontSize: 11, letterSpacing: "0.4px" }}
    >
      {titleCasePlan(p)}
    </span>
  );
}

function SmallStackedBars({ series, loading }) {
  const max = useMemo(() => {
    if (!Array.isArray(series) || series.length === 0) return 1;
    return Math.max(1, ...series.map((d) => Number(d?.total || 0)));
  }, [series]);

  if (loading) {
    return (
      <div className="d-flex gap-2 align-items-end" style={{ height: 120 }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="bg-body-tertiary rounded"
            style={{ width: 10, height: 24 + (i % 4) * 10, opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="d-flex gap-2 align-items-end" style={{ height: 120 }}>
      {(series || []).map((d) => {
        const total = Number(d?.total || 0);
        const free = Number(d?.free || 0);
        const pro = Number(d?.pro || 0);
        const business = Number(d?.business || 0);
        const h = Math.max(6, Math.round((total / max) * 120));
        const freeH = total ? Math.round((free / total) * h) : 0;
        const proH = total ? Math.round((pro / total) * h) : 0;
        const bizH = Math.max(0, h - freeH - proH);

        return (
          <div key={d.day} className="d-flex flex-column align-items-center" style={{ width: 10 }}>
            <div
              className="rounded overflow-hidden"
              title={`${d.day}: ${total} vendors (free ${free}, pro ${pro}, business ${business})`}
              style={{
                width: 10,
                height: h,
                background: "rgba(226,232,240,0.8)",
                display: "flex",
                flexDirection: "column-reverse",
              }}
            >
              <div style={{ height: freeH, background: "rgba(34,197,94,0.65)" }} />
              <div style={{ height: proH, background: "rgba(101,113,255,0.75)" }} />
              <div style={{ height: bizH, background: "rgba(245,158,11,0.75)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SuperAdminDashboard({
  metrics,
  loading,
  onGoUsers,
  onGoForms,
}) {
  const users = Number(metrics?.users || 0);
  const forms = Number(metrics?.forms || 0);
  const planCounts = metrics?.plans?.counts || { free: 0, pro: 0, business: 0 };
  const totalPlans = Number(metrics?.plans?.total || 0);
  const paidPlans = Number(planCounts.pro || 0) + Number(planCounts.business || 0);
  const series = Array.isArray(metrics?.signupSeries) ? metrics.signupSeries : [];

  const vendorRows = useMemo(() => {
    const by = metrics?.usersByPlan || {};
    const rows = []
      .concat(by.business || [], by.pro || [], by.free || [])
      .slice(0, 80);
    return rows;
  }, [metrics]);

  return (
    <div className="py-3">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <h4 className="mb-1 fw-bold">Super Admin Dashboard</h4>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Overview of vendors, forms, plans and recent signups
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-md-4">
          <div
            className="card shadow-sm border-0 p-4 h-100"
            onClick={onGoUsers}
            style={{ cursor: "pointer" }}
          >
            <div className="d-flex align-items-start justify-content-between">
              <div>
                <h6 className="text-muted small text-uppercase fw-bold mb-2">Total Vendors</h6>
                <h2 className="mb-0">{loading ? "..." : users}</h2>
              </div>
              <span className="badge bg-primary-subtle text-primary rounded-pill">Vendors</span>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div
            className="card shadow-sm border-0 p-4 h-100"
            onClick={onGoForms}
            style={{ cursor: "pointer" }}
          >
            <div className="d-flex align-items-start justify-content-between">
              <div>
                <h6 className="text-muted small text-uppercase fw-bold mb-2">Total Forms</h6>
                <h2 className="mb-0">{loading ? "..." : forms}</h2>
              </div>
              <span className="badge bg-success-subtle text-success rounded-pill">Forms</span>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card shadow-sm border-0 p-4 h-100">
            <div className="d-flex align-items-start justify-content-between">
              <div>
                <h6 className="text-muted small text-uppercase fw-bold mb-2">Total Plans</h6>
                <h2 className="mb-0">{loading ? "..." : totalPlans}</h2>
                <div className="text-muted mt-1" style={{ fontSize: 13 }}>
                  Paid: <span className="fw-semibold">{loading ? "..." : paidPlans}</span>
                </div>
              </div>
              <span className="badge bg-warning-subtle text-warning rounded-pill">Plans</span>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card shadow-sm border-0 p-4 h-100">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
              <div>
                <h6 className="mb-1 fw-bold">Plan breakdown</h6>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  Vendors by subscription plan
                </div>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <span className="badge bg-success-subtle text-success rounded-pill">
                  Free: {loading ? "..." : Number(planCounts.free || 0)}
                </span>
                <span className="badge bg-primary-subtle text-primary rounded-pill">
                  Pro: {loading ? "..." : Number(planCounts.pro || 0)}
                </span>
                <span className="badge bg-warning-subtle text-warning rounded-pill">
                  Business: {loading ? "..." : Number(planCounts.business || 0)}
                </span>
              </div>
            </div>

            <div className="row g-3 align-items-center">
              <div className="col-md-6">
                <div className="text-muted mb-2" style={{ fontSize: 13 }}>
                  Last 14 days vendor signups
                </div>
                <SmallStackedBars series={series} loading={loading} />
              </div>
              <div className="col-md-6">
                <div className="p-3 rounded-3 bg-body-tertiary">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="fw-semibold">Legend</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      stacked bars
                    </div>
                  </div>
                  <div className="d-flex flex-column gap-2" style={{ fontSize: 13 }}>
                    <div className="d-flex align-items-center gap-2">
                      <span style={{ width: 10, height: 10, background: "rgba(34,197,94,0.65)", borderRadius: 3 }} />
                      <span>Free</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span style={{ width: 10, height: 10, background: "rgba(101,113,255,0.75)", borderRadius: 3 }} />
                      <span>Pro</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span style={{ width: 10, height: 10, background: "rgba(245,158,11,0.75)", borderRadius: 3 }} />
                      <span>Business</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card shadow-sm border-0 p-4 h-100 z-0">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div>
                <h6 className="mb-1 fw-bold">Who took which plan</h6>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  Recent vendors (latest 80)
                </div>
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: 320, overflowY: "auto" }}>
              <table className="table table-sm align-middle mb-0">
                <thead className="sticky-top bg-body">
                  <tr className="text-muted" style={{ fontSize: 12 }}>
                    <th style={{ width: "55%" }}>Vendor</th>
                    <th style={{ width: "25%" }}>Plan</th>
                    <th style={{ width: "20%" }} className="text-end">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: 13 }}>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-muted">
                        Loading…
                      </td>
                    </tr>
                  ) : vendorRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-muted">
                        No vendors found
                      </td>
                    </tr>
                  ) : (
                    vendorRows.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="fw-semibold">{u.name || "-"}</div>
                          <div className="text-muted" style={{ fontSize: 12 }}>
                            {u.email || "-"}
                          </div>
                        </td>
                        <td>
                          <PlanBadge plan={u.subscriptionPlan} />
                        </td>
                        <td className="text-end text-muted" style={{ fontSize: 12 }}>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

