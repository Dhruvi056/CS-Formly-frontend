import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

export default function AdminUsersTable({ searchQuery = "" }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState("vendor_admin");
  const [draftVendorId, setDraftVendorId] = useState("");
  const [editingSaving, setEditingSaving] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);

  useEffect(() => {
    if (searchQuery) setSearchTerm(searchQuery);
  }, [searchQuery]);

  const LucideIcon = ({ name, className = "", style = {} }) => {
    useEffect(() => {
      if (window.lucide) window.lucide.createIcons();
    }, [name]);
    return (
      <span
        className={`d-inline-flex align-items-center justify-content-center ${className}`}
        style={style}
        dangerouslySetInnerHTML={{ __html: `<i data-lucide="${name}"></i>` }}
      />
    );
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        toast.error(data?.message || "Failed to fetch users");
        setUsers([]);
        return;
      }
      setUsers(
        (Array.isArray(data) ? data : []).map((u) => ({
          ...u,
          id: u._id,
          joined: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—",
          name: u.name || "-",
          vendorId: u.vendorId || String(u._id),
        }))
      );
    } catch (err) {
      toast.error("Failed to fetch users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const s = (searchTerm || "").toLowerCase();
    return users.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const vId = (u.vendorId || "").toLowerCase();
      return name.includes(s) || email.includes(s) || vId.includes(s);
    });
  }, [users, searchTerm]);

  const totalCount = users.length;

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  return (
    <div className="card shadow-sm border-0">
      <div className="card-body">
        <style>
          {`
            .custom-search-input-focus:focus-within {
              border-color: #e9ecef !important;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
              transition: all 0.2s ease-in-out;
            }
            .form-control-custom:focus {
              border-color: transparent !important;
              box-shadow: none !important;
            }
            .admin-user-action-btn {
              width: 34px;
              height: 34px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              padding: 0;
              border-radius: 10px;
            }
          `}
        </style>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div>
            <h5 className="mb-1 fw-bold">Vendors</h5>
            <p className="text-muted small mb-0">Manage all registered vendor accounts</p>
          </div>
          <div className="d-flex align-items-center gap-3">
            <div
              className="input-group input-group-sm border rounded-pill overflow-hidden bg-white custom-search-input-focus d-none d-md-flex"
              style={{ width: "250px" }}
            >
              <span className="input-group-text bg-white border-0 ps-3">
                <LucideIcon name="search" className="text-muted icon-sm" />
              </span>
              <input
                type="text"
                className="form-control border-0 bg-transparent py-2 shadow-none form-control-custom"
                placeholder="Search vendors by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill">
              {`${totalCount} Vedors`}
            </span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-body-tertiary">
              <tr>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Name</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Email</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Joined</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Role</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Plan</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Vendor ID</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td className="fw-semibold">{u.name || "-"}</td>
                  <td>{u.email || "-"}</td>
                  <td className="text-muted">{u.joined}</td>
                  <td className="text-capitalize">{(u.role || "vendor_admin").replace("_", " ")}</td>
                  <td className="text-capitalize">
                    <span
                      className={`badge rounded-pill ${
                        u.subscriptionPlan === "business"
                          ? "bg-warning-subtle text-warning"
                          : u.subscriptionPlan === "pro"
                            ? "bg-primary-subtle text-primary"
                            : "bg-success-subtle text-success"
                      }`}
                    >
                      {u.subscriptionPlan || "free"}
                    </span>
                  </td>
                  <td
                    className="text-muted"
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
                  >
                    {u.vendorId || "-"}
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary me-2 admin-user-action-btn"
                      onClick={() => {
                        setEditingUser(u);
                        setDraftName(u.name || "");
                        setDraftRole(u.role === "super_admin" ? "super_admin" : "vendor_admin");
                        setDraftVendorId(u.vendorId || "");
                        setShowEditModal(true);
                      }}
                      title="Edit user"
                    >
                      <LucideIcon name="pencil" className="icon-sm" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary admin-user-action-btn"
                      onClick={() => setViewTarget(u)}
                      title="View user details"
                    >
                      <LucideIcon name="eye" className="icon-sm" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-5">
                    No users found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showEditModal && editingUser && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1200 }}>
          <div className="modal-dialog modal-dialog-centered modal-md">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header">
                <h5 className="modal-title">Edit User</h5>
                <button type="button" className="btn-close" onClick={() => setShowEditModal(false)} />
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editingUser?.id) return;
                  setEditingSaving(true);
                  try {
                    const token = localStorage.getItem("authToken");
                    const res = await fetch(`/api/admin/users/${editingUser.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({
                        name: draftName.trim(),
                        role: draftRole,
                        vendorId: draftVendorId.trim(),
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      toast.error(data.message || "Failed to update user.");
                      return;
                    }
                    toast.success("User updated.");
                    setShowEditModal(false);
                    await fetchUsers();
                  } catch (err) {
                    toast.error("Failed to update user.");
                  } finally {
                    setEditingSaving(false);
                  }
                }}
              >
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-bold">Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Email</label>
                    <input type="email" className="form-control" value={editingUser.email || ""} disabled />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Role</label>
                    <select className="form-select" value={draftRole} onChange={(e) => setDraftRole(e.target.value)}>
                      <option value="vendor_admin">vendor_admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Vendor ID</label>
                    <input
                      type="text"
                      className="form-control"
                      value={draftVendorId}
                      onChange={(e) => setDraftVendorId(e.target.value)}
                      placeholder="e.g. vendorId"
                    />
                  </div>
                </div>

                <div className="modal-footer border-top-0 pt-0">
                  <button type="button" className="btn btn-light px-4" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary px-4" disabled={editingSaving}>
                    {editingSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {viewTarget && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.55)", zIndex: 1200 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 560 }}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
              <div className="modal-header border-0 pb-0 pt-4 px-4">
                <div className="d-flex gap-3 align-items-start">
                  <div
                    className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: 44, height: 44 }}
                  >
                    <LucideIcon name="eye" className="text-primary" style={{ width: 20, height: 20 }} />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold mb-1">User details</h5>
                    <p className="text-muted small mb-0">
                      Complete subscription details and account info.
                    </p>
                  </div>
                </div>
                <button type="button" className="btn-close mt-1" aria-label="Close" onClick={() => setViewTarget(null)} />
              </div>
              <div className="modal-body px-4 pt-3 pb-2">
                <div className="row g-3 mb-3">
                  <div className="col-sm-6">
                    <div className="small text-muted">Name</div>
                    <div className="fw-semibold">{viewTarget.name || "-"}</div>
                  </div>
                  <div className="col-sm-6">
                    <div className="small text-muted">Email</div>
                    <div className="fw-semibold">{viewTarget.email || "-"}</div>
                  </div>
                  <div className="col-sm-6">
                    <div className="small text-muted">Joined</div>
                    <div className="fw-semibold">{viewTarget.joined || "—"}</div>
                  </div>
                  <div className="col-sm-6">
                    <div className="small text-muted">Current Plan</div>
                    <div className="fw-semibold text-capitalize">{viewTarget.subscriptionPlan || "free"}</div>
                  </div>
                </div>

                <div className="border rounded-3 p-3 bg-light-subtle">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="fw-semibold">Subscription history</div>
                    <span className="badge rounded-pill bg-primary-subtle text-primary">
                      {Array.isArray(viewTarget.planHistory) ? viewTarget.planHistory.length : 0} times
                    </span>
                  </div>

                  {Array.isArray(viewTarget.planHistory) && viewTarget.planHistory.length > 0 ? (
                    <ul className="list-group list-group-flush">
                      {[...viewTarget.planHistory]
                        .sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0))
                        .map((entry, idx) => (
                          <li key={`${entry?.date || "d"}-${idx}`} className="list-group-item px-0 py-2 bg-transparent">
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="text-capitalize fw-semibold">
                                {entry?.plan || "free"} plan
                              </div>
                              <small className="text-muted">
                                {entry?.date ? new Date(entry.date).toLocaleDateString() : "—"}
                              </small>
                            </div>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <div className="small text-muted">No subscription records found.</div>
                  )}
                </div>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-2">
                <button className="btn btn-primary px-4" onClick={() => setViewTarget(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
