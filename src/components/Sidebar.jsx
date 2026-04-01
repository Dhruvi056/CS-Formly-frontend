import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AddFormPopup from "./AddFormPopup.jsx";
import { normalizeMongoId } from "../utils/mongoIds.js";

export default function Sidebar({
  onSelectForm,
  selectedForm,
  onClearAllNotifications,
  clearNotificationsToken,
  onSelectAdminSection,
  activeAdminSection,
  sidebarRefreshKey = 0,
}) {
  const [showPopup, setShowPopup] = useState(false);
  const [forms, setForms] = useState([]);
  const [folders, setFolders] = useState([]);
  const [listsRefresh, setListsRefresh] = useState(0);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [newSubmissionCounts, setNewSubmissionCounts] = useState({});
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const { currentUser, userMeta } = useAuth();
  const { addToast } = useToast();
  const latestByFormRef = useRef({});
  const hasSeededLatestRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showLogoutMenu && !event.target.closest('.logout-menu-container')) {
        setShowLogoutMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLogoutMenu]);

  // --- MONGODB MIGRATION: Fetching Forms & Folders ---
  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const headers = { "Authorization": `Bearer ${token}` };

        const formsRes = await fetch("/api/forms", { headers });
        if (formsRes.ok) {
          const formsData = await formsRes.json();

          setForms(formsData.map(f => ({ ...f, formId: f._id, id: f._id })));
        }
        const foldersRes = await fetch("/api/folders", { headers });
        if (foldersRes.ok) {
          const foldersData = await foldersRes.json();

          setFolders(foldersData.map(f => ({ ...f, id: f._id })));
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      }
    };

    fetchData();
  }, [currentUser, listsRefresh, sidebarRefreshKey]);

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
    const interval = setInterval(poll, 7000);
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

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          CS <span>Formly</span>
        </div>
        <div className="sidebar-toggler" style={{ color: '#7987a1', display: 'flex' }} onClick={() => document.body.classList.toggle('sidebar-folded')}>
          <LucideIcon name="menu" className="icon-md" />
        </div>
      </div>
      <div className="sidebar-body" style={{ overflowX: "hidden" }}>
        <ul className="nav" id="sidebarNav">
          {isSuperAdmin ? (
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
                  <span className="link-title">Vendor Admin</span>
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
          ) : (
            <>
              <li className="nav-item nav-category">Forms & Folders</li>

              <li className="nav-item">
                <button
                  onClick={() => setShowPopup(true)}
                  className="nav-link btn btn-link w-100 text-start border-0 d-flex align-items-center"
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  <LucideIcon name="plus-circle" className="link-icon" />
                  <span className="link-title">Create...</span>
                </button>
              </li>

              <li className={`nav-item ${homeActive ? "active" : ""}`}>
                <button
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

              {folders.length > 0 && (
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
            </>
          )}
        </ul>
      </div>

      {showPopup && (
        <AddFormPopup
          onClose={() => setShowPopup(false)}
          onSelectForm={onSelectForm}
          onCreated={() => setListsRefresh((n) => n + 1)}
        />
      )}
    </nav>
  );
}
