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


        <div className="col-12">
          <div className="card shadow-sm border-0 p-4 h-100 w-100">

            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="mb-0 fw-semibold">Vendors by Plan</h5>
            </div>

            <div className="table-responsive">
              <table className="table align-middle mb-0">

                <thead className="border-bottom">
                  <tr className="text-muted small">
                    <th style={{ width: "55%" }}>Vendor</th>
                    <th style={{ width: "25%" }}>Plan</th>
                    <th style={{ width: "20%" }} className="text-end">
                      Joined
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-muted">
                        Loading...
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
                      <tr
                        key={u.id}
                        style={{ cursor: "pointer", transition: "0.2s" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#f8fafc")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <td>
                          <div className="fw-semibold">{u.name || "-"}</div>
                          <div className="text-muted small">
                            {u.email || "-"}
                          </div>
                        </td>

                        <td>
                          <PlanBadge plan={u.subscriptionPlan} />
                        </td>

                        <td className="text-end text-muted small">
                          {u.createdAt
                            ? new Date(u.createdAt).toLocaleDateString("en-US", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                            : "-"}
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

