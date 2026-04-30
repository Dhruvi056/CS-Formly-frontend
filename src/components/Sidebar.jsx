import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useNavigate } from "react-router-dom";
import AddFormPopup from "./AddFormPopup.jsx";
import { normalizeMongoId } from "../utils/mongoIds.js";

const FREE_STORAGE_BYTES = 1024 * 1024 * 1024;

const LucideIcon = ({ name, className = "" }) => {
  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [name]);
  return (
    <span
      className="d-inline-flex align-items-center justify-content-center"
      dangerouslySetInnerHTML={{ __html: `<i data-lucide="${name}" class="${className}" stroke-width="2"></i>` }}
    />
  );
};

function formatBytes(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const GB = 1024 * 1024 * 1024;
  const MB = 1024 * 1024;
  if (v >= GB) return `${(v / GB).toFixed(1)} GB`;
  if (v >= MB) return `${(v / MB).toFixed(1)} MB`;
  if (v >= 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${Math.round(v)} B`;
}

export default function Sidebar({
  onSelectForm,
  selectedForm,
  onClearAllNotifications,
  clearNotificationsToken,
  onSelectAdminSection,
  activeAdminSection,
  sidebarRefreshKey = 0,
}) {
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  const [forms, setForms] = useState([]);
  const [folders, setFolders] = useState([]);
  const [listsRefresh, setListsRefresh] = useState(0);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [newSubmissionCounts, setNewSubmissionCounts] = useState({});
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [usageData, setUsageData] = useState(null);
  const { currentUser, userMeta } = useAuth();
  const { addToast } = useToast();
  const latestByFormRef = useRef({});
  const hasSeededLatestRef = useRef(false);

  // Keep usage cards (submissions/storage/forms) fresh without manual refresh.
  useEffect(() => {
    if (!currentUser) return;
    if (userMeta?.role === "super_admin") return;

    let cancelled = false;

    const fetchUsage = async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        const usageRes = await fetch("/api/billing/usage", { headers });
        if (!usageRes.ok) return;
        const usageJson = await usageRes.json();
        if (!cancelled) setUsageData(usageJson);
      } catch {
        // ignore
      }
    };

    fetchUsage();
    const intervalId = setInterval(fetchUsage, 5000);
    const onFocus = () => fetchUsage();
    const onVisible = () => {
      if (!document.hidden) fetchUsage();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [currentUser, userMeta?.role]);


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showLogoutMenu && !event.target.closest('.logout-menu-container')) {
        setShowLogoutMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLogoutMenu]);

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const headers = { "Authorization": `Bearer ${token}` };

        const formsRes = await fetch("/api/forms", { headers });
        if (formsRes.ok) {
          const formsData = await formsRes.json();
          let myForms = formsData;
          if (userMeta?.role === "super_admin") {
            myForms = formsData.filter(f => {
              const ownerId = typeof f.user === "object" ? f.user?._id : f.user;
              return String(ownerId) === String(currentUser.uid);
            });
          }
          setForms(myForms.map(f => ({ ...f, formId: f._id, id: f._id })));
        }

        const foldersRes = await fetch("/api/folders", { headers });
        if (foldersRes.ok) {
          const foldersData = await foldersRes.json();
          let myFolders = foldersData;
          if (userMeta?.role === "super_admin") {
            myFolders = foldersData.filter(f => {
              const ownerId = typeof f.user === "object" ? f.user?._id : f.user;
              return String(ownerId) === String(currentUser.uid);
            });
          }
          setFolders(myFolders.map(f => ({ ...f, id: f._id })));
        }

        // Usage stats are fetched on an interval (see effect above)
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      }
    };

    fetchData();
  }, [currentUser, listsRefresh, sidebarRefreshKey, userMeta?.role]);

  // --- MongoDB: New submission notifications (polling) ---
  useEffect(() => {
    if (!currentUser) return;
    if (!forms || forms.length === 0) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch("/api/submissions/latest", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ formIds: forms.map((f) => f.formId) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (cancelled) return;

        const latestMap = data.result || {};

        // Seed baseline once so we don't toast for existing submissions
        if (!hasSeededLatestRef.current) {
          Object.entries(latestMap).forEach(([formId, info]) => {
            latestByFormRef.current[formId] = info?.latestCreatedAtMs || 0;
          });
          hasSeededLatestRef.current = true;
          return;
        }

        Object.entries(latestMap).forEach(([formId, info]) => {
          const latestMs = info?.latestCreatedAtMs || 0;
          const prevMs = latestByFormRef.current[formId] || 0;
          if (!latestMs || latestMs <= prevMs) return;

          latestByFormRef.current[formId] = latestMs;
          if (selectedForm?.formId === formId) return;

          const formName = forms.find((f) => f.formId === formId)?.name || "Form";

          setNewSubmissionCounts((prev) => ({
            ...prev,
            [formId]: (prev[formId] || 0) + 1,
          }));

          addToast(`1 new submission in ${formName}`, "info");
        });
      } catch {
        // ignore
      }
    };

    poll();
    const interval = setInterval(poll, 10000);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [currentUser, forms, selectedForm?.formId, addToast]);

  useEffect(() => {
    const activeFormId = selectedForm?.formId;
    if (!activeFormId) return;
    setNewSubmissionCounts((prev) => {
      if (!prev[activeFormId]) return prev;
      const next = { ...prev };
      delete next[activeFormId];
      return next;
    });
  }, [selectedForm?.formId]);

  useEffect(() => {
    setNewSubmissionCounts({});
  }, [clearNotificationsToken]);

  useEffect(() => {
    return () => {
      // no-op (mongo polling cleanup handled in effect)
    };
  }, []);

  const homeActive = !selectedForm;
  const isSuperAdmin = userMeta?.role === "super_admin";

  // API populates folderId as { _id, name }; compare using normalized ids
  const formsByFolder = {};
  forms.forEach((form) => {
    const fid = normalizeMongoId(form.folderId);
    if (fid) {
      const folderExists = folders.some((folder) => String(folder.id) === fid);
      if (folderExists) {
        if (!formsByFolder[fid]) formsByFolder[fid] = [];
        formsByFolder[fid].push(form);
      }
    }
  });

  const formsWithoutFolder = forms.filter((form) => !normalizeMongoId(form.folderId));



  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <button
          type="button"
          className="sidebar-brand btn btn-link p-0 border-0 text-decoration-none"
          onClick={() => {
            onSelectForm?.(null);
            navigate("/", { replace: true });
          }}
          style={{ cursor: "pointer" }}
          aria-label="Go to Home"
        >
          CS <span>Formly</span>
        </button>
        <div className="sidebar-toggler" style={{ color: '#7987a1', display: 'flex' }} onClick={() => document.body.classList.toggle('sidebar-folded')}>
          <LucideIcon name="menu" className="icon-md" />
        </div>
      </div>
      <div className="sidebar-body" style={{ overflowX: "hidden" }}>
        <ul className="nav" id="sidebarNav">
          {isSuperAdmin && (
            <>
              <li className={`nav-item ${activeAdminSection === "dashboard" ? "active" : ""}`}>
                <button
                  type="button"
                  onClick={() => onSelectAdminSection?.("dashboard")}
                  className="nav-link btn btn-link w-100 text-start border-0 py-2 fs-14px d-flex align-items-center"
                  style={{
                    color: activeAdminSection === "dashboard" ? "var(--nobleui-primary)" : "#4d5969",
                    textDecoration: "none",
                  }}
                >
                  <LucideIcon name="home" className="link-icon" />
                  <span className="link-title">Dashboard</span>
                </button>
              </li>

              <li className={`nav-item ${activeAdminSection === "users" ? "active" : ""}`}>
                <button
                  type="button"
                  onClick={() => onSelectAdminSection?.("users")}
                  className="nav-link btn btn-link w-100 text-start border-0 py-2 fs-14px d-flex align-items-center"
                  style={{
                    color: activeAdminSection === "users" ? "var(--nobleui-primary)" : "#4d5969",
                    textDecoration: "none",
                  }}
                >
                  <LucideIcon name="users" className="link-icon" />
                  <span className="link-title">Vendors</span>
                </button>
              </li>

              <li className={`nav-item ${activeAdminSection === "forms" ? "active" : ""}`}>
                <button
                  type="button"
                  onClick={() => onSelectAdminSection?.("forms")}
                  className="nav-link btn btn-link w-100 text-start border-0 py-2 fs-14px d-flex align-items-center"
                  style={{
                    color: activeAdminSection === "forms" ? "var(--nobleui-primary)" : "#4d5969",
                    textDecoration: "none",
                  }}
                >
                  <LucideIcon name="file-text" className="link-icon" />
                  <span className="link-title">All forms</span>
                </button>
              </li>
            </>
          )}

          <li className="nav-item nav-category">Forms & Folders</li>

          <li className="nav-item">
            <button
              type="button"
              onClick={() => setShowPopup(true)}
              className="nav-link btn btn-link w-100 text-start border-0 d-flex align-items-center"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              <LucideIcon name="plus-circle" className="link-icon" />
              <span className="link-title">Create...</span>
            </button>
          </li>

          {!isSuperAdmin && (
            <li className={`nav-item ${homeActive ? "active" : ""}`}>
              <button
                type="button"
                onClick={() => onSelectForm(null)}
                className="nav-link btn btn-link w-100 text-start border-0 d-flex align-items-center"
                style={{
                  color: homeActive ? "var(--nobleui-primary)" : "inherit",
                  textDecoration: "none",
                }}
              >
                <LucideIcon name="home" className="link-icon" />
                <span className="link-title">Home</span>
              </button>
            </li>
          )}

          {(!isSuperAdmin && usageData && (userMeta?.subscriptionPlan || "free") !== "business") && (() => {
            const limits = usageData.limits;
            const atFormLimit = limits.maxForms && forms.length >= limits.maxForms;
            const atFolderLimit = limits.maxFolders && folders.length >= limits.maxFolders;

            if (!atFormLimit && !atFolderLimit) return null;

            const plan = userMeta?.subscriptionPlan || "free";
            const nextPlan = plan === "free" ? "Pro" : (plan === "pro" ? "Business" : null);

            return (
              <li className="nav-item px-auto mt-1 mb-2">
                <div className="p-2 bg-white border d-flex flex-column gap-2 rounded-3" style={{ borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div className="d-flex align-items-center fw-bold" style={{ fontSize: "14px", color: '#ff3366' }}>
                    <LucideIcon name="alert-triangle" className="icon-sm me-2 flex-shrink-0" style={{ width: '13px', height: '18px', color: '#ff3366' }} />
                    {atFormLimit && atFolderLimit ? "Plan limits reached" : atFormLimit ? "Form limit reached" : "Folder limit reached"}
                  </div>
                  <p className="text-muted mb-0" style={{ fontSize: "12px", lineHeight: "1.4", color: '#4d5969' }}>
                    {nextPlan
                      ? `Upgrade to the ${nextPlan} plan to create more forms and folders.`
                      : "You have reached the maximum limits for your account."}
                  </p>
                  {nextPlan && (
                    <button
                      className="btn btn-sm btn-primary fw-bold align-self-start"
                      style={{ fontSize: "12.5px", borderRadius: 10, padding: "6px 10px" }}
                      onClick={() => navigate('/pricing')}
                      type="button"
                    >
                      Upgrade Now
                    </button>
                  )}
                </div>
              </li>
            );
          })()}

          {/* Submission Usage Bar — shown for free plan users */}
          {!isSuperAdmin && usageData && (() => {
            const used = usageData.usage?.submissions ?? 0;
            const max = usageData.limits?.maxSubmissions ?? 50;
            const pct = Math.min(100, Math.round((used / max) * 100));
            const isAtLimit = used >= max;
            const isNearLimit = pct >= 80;
            const barColor = isAtLimit ? '#ef4444' : isNearLimit ? '#f97316' : '#6571ff';
            return (
              <li className="nav-item px-auto mt-1 mb-2">
                <div className="p-3 bg-white border d-flex flex-column gap-2 rounded-3" style={{ borderColor: isAtLimit ? '#fca5a5' : '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div className="d-flex flex-column" style={{ fontWeight: 600, color: isAtLimit ? '#ef4444' : '#4d5969' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                      <LucideIcon name={isAtLimit ? 'alert-circle' : 'inbox'} className="icon-sm flex-shrink-0" />
                      Submissions
                    </span>
                    <span style={{ marginTop: '2px', fontSize: '11.5px', fontWeight: 500, color: isAtLimit ? '#ef4444' : '#7987a1' }}>
                      {used.toLocaleString()} / {max.toLocaleString()}
                    </span>
                  </div>
                  {/* progress bar */}
                  <div style={{ height: '6px', borderRadius: '99px', background: '#e9ecef', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${used > 0 ? Math.max(1, pct) : 0}%`, background: barColor, borderRadius: '99px', transition: 'width 0.4s ease' }} />
                  </div>
                  {isAtLimit ? (
                    <>
                      <p className="mb-0" style={{ fontSize: '12.5px', color: '#ef4444', fontWeight: 500 }}>
                        Submission limit reached. New submissions are blocked.
                      </p>
                      <button
                        className="btn btn-sm btn-primary fw-bold align-self-start"
                        style={{ fontSize: '12.5px', borderRadius: 10, padding: "6px 10px" }}
                        onClick={() => navigate('/pricing')}
                        type="button"
                      >
                        Upgrade to Pro
                      </button>
                    </>
                  ) : isNearLimit ? (
                    <p className="mb-0" style={{ fontSize: '12px', color: '#f97316' }}>
                      Approaching limit — upgrade soon.
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })()}

          {/* Storage Usage Bar — shown for plans with storage caps */}
          {!isSuperAdmin && usageData && usageData.limits?.maxStorageBytes != null && (() => {
            const used = usageData.usage?.storageBytes ?? 0;
            const plan = (userMeta?.subscriptionPlan || "free").toLowerCase();
            const apiMax = usageData.limits?.maxStorageBytes ?? 0;
            const max = plan === "free" ? Math.max(apiMax, FREE_STORAGE_BYTES) : apiMax;
            const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
            const isAtLimit = max > 0 && used >= max;
            const isNearLimit = pct >= 80 && !isAtLimit;
            const barColor = isAtLimit ? '#ef4444' : isNearLimit ? '#f97316' : '#6571ff';

            return (
              <li className="nav-item px-auto mt-1 mb-2">
                <div className="p-3 bg-white border d-flex flex-column gap-2 rounded-3" style={{ borderColor: isAtLimit ? '#fca5a5' : '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div className="d-flex flex-column" style={{ fontWeight: 600, color: isAtLimit ? '#ef4444' : '#4d5969' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                      <LucideIcon name={isAtLimit ? 'alert-circle' : 'hard-drive'} className="icon-sm flex-shrink-0" />
                      File storage
                    </span>
                    <span style={{ marginTop: '2px', fontSize: '11.5px', fontWeight: 500, color: isAtLimit ? '#ef4444' : '#7987a1' }}>
                      {formatBytes(used)} / {formatBytes(max)}
                    </span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '99px', background: '#e9ecef', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${used > 0 ? Math.max(1, pct) : 0}%`, background: barColor, borderRadius: '99px', transition: 'width 0.4s ease' }} />
                  </div>
                  {isAtLimit ? (
                    <>
                      <p className="mb-0" style={{ fontSize: '12.5px', color: '#ef4444', fontWeight: 500 }}>
                        Storage limit reached. New file uploads are blocked.
                      </p>
                      <button
                        className="btn btn-sm btn-primary fw-bold align-self-start"
                        style={{ fontSize: '12.5px', borderRadius: 10, padding: "6px 10px" }}
                        onClick={() => navigate('/pricing')}
                        type="button"
                      >
                        Upgrade plan
                      </button>
                    </>
                  ) : isNearLimit ? (
                    <p className="mb-0" style={{ fontSize: '12px', color: '#f97316' }}>
                      Approaching storage limit — upgrade soon.
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })()}

          {/* Folders Usage Bar */}
          {!isSuperAdmin && usageData && (() => {
            const used = usageData.usage?.folders ?? folders.length ?? 0;
            const max = usageData.limits?.maxFolders ?? null;
            const isUnlimited = max == null;
            const pct = !isUnlimited && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
            const unlimitedPct = used > 0 ? 2 : 0;
            const isAtLimit = !isUnlimited && max > 0 && used >= max;
            const isNearLimit = !isUnlimited && pct >= 80 && !isAtLimit;
            const barColor = isAtLimit ? '#ef4444' : isNearLimit ? '#f97316' : '#6571ff';

            return (
              <li className="nav-item px-auto mt-1 mb-2">
                <div className="p-3 bg-white border d-flex flex-column gap-2 rounded-3" style={{ borderColor: isAtLimit ? '#fca5a5' : '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div className="d-flex align-items-center justify-content-between" style={{ fontSize: '12.5px', fontWeight: 600, color: isAtLimit ? '#ef4444' : '#4d5969' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <LucideIcon name={isAtLimit ? 'alert-circle' : 'folder'} className="icon-sm flex-shrink-0" />
                      Folders
                    </span>
                    <span style={{ color: isAtLimit ? '#ef4444' : '#7987a1' }}>
                      {used.toLocaleString()} / {isUnlimited ? "∞" : max.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '99px', background: '#e9ecef', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: isUnlimited ? `${unlimitedPct}%` : `${pct}%`,
                        background: barColor,
                        borderRadius: '99px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                  {isAtLimit ? (
                    <>
                      <p className="mb-0" style={{ fontSize: '12.5px', color: '#ef4444', fontWeight: 500 }}>
                        Folder limit reached. Upgrade to create more workspaces.
                      </p>
                      <button
                        className="btn btn-sm btn-primary fw-bold align-self-start"
                        style={{ fontSize: '12.5px', borderRadius: 10, padding: "6px 10px" }}
                        onClick={() => navigate('/pricing')}
                        type="button"
                      >
                        Upgrade plan
                      </button>
                    </>
                  ) : isNearLimit ? (
                    <p className="mb-0" style={{ fontSize: '12px', color: '#f97316' }}>
                      Approaching folder limit — upgrade soon.
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })()}

          {/* Forms Usage Bar — requested under usage cards */}
          {!isSuperAdmin && usageData && (() => {
            const used = usageData.usage?.forms ?? forms.length ?? 0;
            const max = usageData.limits?.maxForms ?? null;
            const isUnlimited = max == null;
            const pct = !isUnlimited && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
            const unlimitedPct = used > 0 ? 2 : 0;
            const isAtLimit = !isUnlimited && max > 0 && used >= max;
            const isNearLimit = !isUnlimited && pct >= 80 && !isAtLimit;
            const barColor = isAtLimit ? '#ef4444' : isNearLimit ? '#f97316' : '#6571ff';

            return (
              <li className="nav-item px-auto mt-1 mb-2">
                <div className="p-3 bg-white border d-flex flex-column gap-2 rounded-3" style={{ borderColor: isAtLimit ? '#fca5a5' : '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div className="d-flex align-items-center justify-content-between" style={{ fontSize: '12.5px', fontWeight: 600, color: isAtLimit ? '#ef4444' : '#4d5969' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <LucideIcon name={isAtLimit ? 'alert-circle' : 'file-text'} className="icon-sm flex-shrink-0" />
                      Forms
                    </span>
                    <span style={{ color: isAtLimit ? '#ef4444' : '#7987a1' }}>
                      {used.toLocaleString()} / {isUnlimited ? "∞" : max.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '99px', background: '#e9ecef', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: isUnlimited ? `${unlimitedPct}%` : `${pct}%`,
                        background: barColor,
                        borderRadius: '99px',
                        transition: 'width 0.4s ease',
                        opacity: isUnlimited ? 0.55 : 1,
                      }}
                    />
                  </div>
                  {isAtLimit ? (
                    <>
                      <p className="mb-0" style={{ fontSize: '12.5px', color: '#ef4444', fontWeight: 500 }}>
                        Form limit reached. Create a new form after upgrading.
                      </p>
                      <button
                        className="btn btn-sm btn-primary fw-bold align-self-start"
                        style={{ fontSize: '12.5px', borderRadius: 10, padding: "6px 10px" }}
                        onClick={() => navigate('/pricing')}
                        type="button"
                      >
                        Upgrade plan
                      </button>
                    </>
                  ) : isNearLimit ? (
                    <p className="mb-0" style={{ fontSize: '12px', color: '#f97316' }}>
                      Approaching form limit — upgrade soon.
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })()}

          {formsWithoutFolder.length > 0 && (
            <>
              <li className="nav-item nav-category">Direct Forms</li>
              {formsWithoutFolder.map((f) => {
                const isSelected = selectedForm?.formId === f.formId;
                const unreadCount = newSubmissionCounts[f.formId] || 0;
                return (
                  <li key={f.formId} className={`nav-item ${isSelected ? "active" : ""}`}>
                    <button
                      onClick={() => onSelectForm(f)}
                      className="nav-link btn btn-link w-100 text-start border-0 py-2 fs-14px d-flex align-items-center justify-content-between"
                      style={{
                        color: isSelected ? "var(--nobleui-primary)" : "#4d5969",
                        textDecoration: "none",
                        paddingLeft: "0.75rem",
                      }}
                    >
                      <span className="link-title text-truncate">{f.name}</span>
                      {unreadCount > 0 && (
                        <span
                          className="badge rounded-pill bg-primary ms-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewSubmissionCounts({});
                            onClearAllNotifications?.();
                          }}
                          title="Clear all notifications"
                          role="button"
                          style={{ cursor: "pointer" }}
                        >
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </>
          )}

          {(!isSuperAdmin || folders.length > 0) && (
            <>
              <li className="nav-item nav-category">Folders</li>
              {folders.map((folder) => {
                const folderForms = formsByFolder[folder.id] || [];
                const isFolderExpanded = expandedFolders[folder.id];
                const folderUnreadCount = folderForms.reduce(
                  (total, form) => total + (newSubmissionCounts[form.formId] || 0),
                  0
                );

                return (
                  <li key={folder.id} className="nav-item">
                    <button
                      type="button"
                      className="nav-link btn btn-link w-100 text-start border-0 d-flex align-items-center justify-content-between gap-1 flex-nowrap overflow-hidden"
                      onClick={() =>
                        setExpandedFolders((prev) => ({
                          ...prev,
                          [folder.id]: !isFolderExpanded,
                        }))
                      }
                      style={{ color: "#4d5969", textDecoration: "none", minWidth: 0 }}
                    >
                      <div className="d-flex align-items-center overflow-hidden flex-grow-1 min-w-0">
                        <LucideIcon
                          name={isFolderExpanded ? "folder-open" : "folder"}
                          className="link-icon flex-shrink-0"
                        />
                        <span className="link-title text-truncate">{folder.name}</span>
                        {folderUnreadCount > 0 && (
                          <span
                            className="badge rounded-pill bg-primary ms-2 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewSubmissionCounts({});
                              onClearAllNotifications?.();
                            }}
                            title="Clear all notifications"
                            role="button"
                            style={{ cursor: "pointer" }}
                          >
                            {folderUnreadCount}
                          </span>
                        )}
                      </div>
                      <div
                        className="link-arrow flex-shrink-0 d-inline-flex align-items-center justify-content-center"
                        style={{
                          width: "1.25rem",
                          transform: isFolderExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                          color: "#4d5969",
                        }}
                      >
                        <LucideIcon name="chevron-down" />
                      </div>
                    </button>

                    {isFolderExpanded && (
                      <ul
                        className="nav sub-menu"
                        style={{
                          display: "block",
                          borderLeft: "none",
                          marginLeft: "25px",
                          padding: "5px 0",
                        }}
                      >
                        {folderForms.length === 0 ? (
                          <li className="nav-item">
                            <span className="nav-link disabled py-1 fs-12px text-muted italic">
                              No forms
                            </span>
                          </li>
                        ) : (
                          folderForms.map((f) => {
                            const isSelected = selectedForm?.formId === f.formId;
                            const unreadCount = newSubmissionCounts[f.formId] || 0;
                            return (
                              <li key={f.formId} className="nav-item">
                                <button
                                  onClick={() => onSelectForm(f)}
                                  className={`nav-link btn btn-link w-100 text-start border-0 py-1 fs-13px d-flex align-items-center justify-content-between ${isSelected ? "text-primary fw-bold" : ""
                                    }`}
                                  style={{
                                    color: isSelected ? "var(--nobleui-primary)" : "#4d5969",
                                    textDecoration: "none",
                                  }}
                                >
                                  <span className="text-truncate">{f.name}</span>
                                  {unreadCount > 0 && (
                                    <span
                                      className="badge rounded-pill bg-primary ms-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setNewSubmissionCounts({});
                                        onClearAllNotifications?.();
                                      }}
                                      title="Clear all notifications"
                                      role="button"
                                      style={{ cursor: "pointer" }}
                                    >
                                      {unreadCount}
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </>
          )}
        </ul>
      </div>

      {
        showPopup && (
          <AddFormPopup
            onClose={() => setShowPopup(false)}
            onSelectForm={onSelectForm}
            onCreated={() => setListsRefresh((n) => n + 1)}
          />
        )
      }
    </nav >
  );
}
