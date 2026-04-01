import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

export default function AdminFormsTable({ searchQuery = "" }) {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const navigate = useNavigate();

  useEffect(() => {
    if (searchQuery) setSearchTerm(searchQuery);
  }, [searchQuery]);

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/admin/forms", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        toast.error(data?.message || "Failed to fetch forms");
        setForms([]);
        return;
      }
      setForms(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to fetch forms");
      setForms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  const createdAtText = (value) => {
    try {
      if (value) return new Date(value).toLocaleString();
      return "-";
    } catch {
      return "-";
    }
  };

  const formatRoleLabel = (role) => {
    if (!role) return "-";
    const pretty = String(role).replace(/_/g, " ");
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  };

  const getUserEmail = (f) => f.user?.email || "-";
  const getUserRole = (f) => f.user?.role || "vendor_admin";
  const getVendorName = (f) => f.user?.vendorId || f.vendorId || "-";

  const filteredForms = useMemo(() => {
    const search = (searchTerm || "").toLowerCase();
    let result = forms.filter((f) => {
      const formName = (f.name || "").toLowerCase();
      const formId = String(f._id || "").toLowerCase();
      const folderName = (f.folderId?.name || "").toLowerCase();
      const userEmail = (f.user?.email || "").toLowerCase();
      const userRole = getUserRole(f);
      const vendor = String(getVendorName(f) || "").toLowerCase();

      const searchMatch =
        formName.includes(search) ||
        formId.includes(search) ||
        folderName.includes(search) ||
        userEmail.includes(search) ||
        vendor.includes(search);

      const roleMatch = selectedRole === "all" || userRole === selectedRole;
      return searchMatch && roleMatch;
    });

    result.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [forms, searchTerm, selectedRole, sortOrder]);

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
          `}
        </style>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div>
            <h5 className="mb-1 fw-bold">All Forms</h5>
            <p className="text-muted small mb-0">Manage and oversee all platform forms</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill">
              {loading ? "Loading..." : `${filteredForms.length} shown`}
            </span>
            {searchTerm || selectedRole !== "all" ? (
              <button
                className="btn btn-link btn-sm text-muted p-0 text-decoration-none"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedRole("all");
                  setSortOrder("newest");
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        <div className="row g-3 mb-4 bg-body-tertiary p-3 rounded-3 mx-0">
          <div className="col-12 col-md-4">
            <label className="form-label small fw-bold text-secondary">Search</label>
            <div className="input-group input-group-sm border rounded-pill overflow-hidden bg-white custom-search-input-focus">
              <span className="input-group-text bg-white border-0 ps-3">
                <i className="text-muted" data-lucide="search" style={{ width: "14px" }}></i>
              </span>
              <input
                type="text"
                className="form-control border-0 bg-transparent py-2 shadow-none form-control-custom"
                placeholder="Name, ID, User..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-4">
            <label className="form-label small fw-bold text-secondary">Filter by Role</label>
            <select className="form-select form-select-sm" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="vendor_admin">Vendor Admin</option>
            </select>
          </div>

          <div className="col-6 col-md-4">
            <label className="form-label small fw-bold text-secondary">Sort Order</label>
            <select className="form-select form-select-sm" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-body-tertiary">
              <tr>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Form</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Folder</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">User</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Role</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Vendor</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredForms.map((f) => (
                <tr
                  key={String(f._id)}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/forms/${f._id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") navigate(`/forms/${f._id}`);
                  }}
                >
                  <td className="fw-semibold">{f.name || "-"}</td>
                  <td className="text-muted">{f.folderId?.name || "-"}</td>
                  <td className="text-muted">{getUserEmail(f)}</td>
                  <td className="text-muted">
                    <span className={`badge ${getUserRole(f) === "super_admin" ? "bg-danger-subtle text-danger" : "bg-info-subtle text-info"} px-2 py-1 rounded`}>
                      {formatRoleLabel(getUserRole(f))}
                    </span>
                  </td>
                  <td className="text-muted">{getVendorName(f)}</td>
                  <td className="text-muted">{createdAtText(f.createdAt)}</td>
                </tr>
              ))}
              {filteredForms.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-5">
                    <div className="d-flex flex-column align-items-center">
                      <i className="mb-2 opacity-25" data-lucide="search" style={{ width: "48px", height: "48px" }}></i>
                      <span>No forms match your search criteria.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
