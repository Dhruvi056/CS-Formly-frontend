import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { normalizeMongoId } from "../utils/mongoIds.js";

function ChevronDown({ open }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-secondary flex-shrink-0"
      aria-hidden
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.2s ease",
      }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Searchable timezone field; menu renders in a portal so it is not clipped by the modal.
 */
function TimezonePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  const allTimezones = [
    { name: "Asia/Kolkata", label: "Asia/Kolkata (UTC+05:30)" },
    { name: "Asia/Colombo", label: "Asia/Colombo (UTC+05:30)" },
    { name: "Asia/Singapore", label: "Asia/Singapore (UTC+08:00)" },
    { name: "Asia/Dubai", label: "Asia/Dubai (UTC+04:00)" },
    { name: "Europe/London", label: "Europe/London (UTC+01:00)" },
    { name: "Europe/Paris", label: "Europe/Paris (UTC+02:00)" },
    { name: "America/New_York", label: "America/New_York (UTC-04:00)" },
    { name: "America/Los_Angeles", label: "America/Los_Angeles (UTC-07:00)" },
    { name: "Pacific/Auckland", label: "Pacific/Auckland (UTC+12:00)" },
    { name: "Australia/Sydney", label: "Australia/Sydney (UTC+10:00)" },
  ];

  const filteredTimezones = allTimezones.filter((tz) =>
    tz.label.toLowerCase().includes(search.toLowerCase())
  );

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const panelMax = 240;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(
      panelMax,
      openUp ? spaceAbove - 4 : spaceBelow - 4
    );
    const top = openUp ? Math.max(margin, rect.top - maxHeight - 4) : rect.bottom + 4;
    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      top,
      maxHeight: Math.max(120, maxHeight),
      zIndex: 100050,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onScrollResize = () => updateMenuPosition();
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onDoc = (e) => {
      const t = e.target;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [isOpen]);

  const menu =
    isOpen &&
    menuStyle &&
    createPortal(
      <div
        ref={menuRef}
        className="bg-white border shadow-lg"
        style={{
          ...menuStyle,
          borderRadius: "12px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
        }}
      >
        <div className="p-2 border-bottom bg-white flex-shrink-0">
          <input
            type="text"
            autoFocus
            className="form-control form-control-sm border-0 shadow-none"
            placeholder="Search timezone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: "13px" }}
          />
        </div>
        <div className="flex-grow-1" style={{ overflowY: "auto", minHeight: 0 }}>
          {filteredTimezones.length > 0 ? (
            filteredTimezones.map((tz) => (
              <div
                key={tz.name}
                className="px-3 py-2 dropdown-item-custom"
                style={{ fontSize: "13px", cursor: "pointer" }}
                onClick={() => {
                  onChange(tz.label);
                  setIsOpen(false);
                  setSearch("");
                }}
              >
                {tz.label}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-muted small">No timezones found</div>
          )}
        </div>
      </div>,
      document.body
    );

  return (
    <div className="position-relative">
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((o) => !o);
          }
        }}
        className="form-control shadow-none d-flex justify-content-between align-items-center bg-white gap-2"
        onClick={() => setIsOpen((o) => !o)}
        style={{
          height: "42px",
          borderRadius: "8px",
          border: "1px solid #e1e8ed",
          fontSize: "13.5px",
          cursor: "pointer",
          minWidth: 0,
        }}
      >
        <span className="text-truncate">{value || "Select Timezone"}</span>
        <ChevronDown open={isOpen} />
      </div>
      {menu}
    </div>
  );
}

export default function AddFormPopup({ onClose, onSelectForm, onCreated }) {
  const [activeTab, setActiveTab] = useState("Form");
  const [formName, setFormName] = useState("");
  const [folderName, setFolderName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata (UTC+05:30)");
  const [folders, setFolders] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [formLimitError, setFormLimitError] = useState("");
  const { currentUser, userMeta } = useAuth();
  const navigate = useNavigate();

  const plan = userMeta?.subscriptionPlan || "free";
  const maxFolders = plan === "free" ? 2 : plan === "pro" ? 5 : 999;
  const isFolderLimitReached = folders.length >= maxFolders;

  const LucideIcon = ({ name, className = "" }) => {
    useEffect(() => {
      if (window.lucide) window.lucide.createIcons();
    }, [name]);
    return (
      <span
        className="d-inline-flex align-items-center justify-content-center"
        dangerouslySetInnerHTML={{ __html: `<i data-lucide="${name}" class="${className}" stroke-width="1.5"></i>` }}
      />
    );
  };


  const isFormValid = activeTab === "Form"
    ? (formName.trim() !== "" && selectedFolder !== "")
    : (folderName.trim() !== "");

  useEffect(() => {
    if (!currentUser) return;
    const fetchFolders = async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) return;
        const res = await fetch("/api/folders", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const foldersData = await res.json();
          let myFolders = foldersData;
          if (userMeta?.role === "super_admin") {
            myFolders = foldersData.filter(f => {
              const ownerId = typeof f.user === "object" ? f.user?._id : f.user;
              return String(ownerId) === String(currentUser.uid);
            });
          }
          setFolders(myFolders);
        }
      } catch (err) {
        console.error("Error fetching folders:", err);
      }
    };
    fetchFolders();
  }, [currentUser]);

  const handleCreate = async () => {
    if (isCreating || !isFormValid) return;
    const token = localStorage.getItem("authToken");
    setIsCreating(true);

    try {
      const isFormPage = activeTab === "Form";
      const endpoint = isFormPage ? "/api/forms" : "/api/folders";
      const payload = isFormPage
        ? { name: formName.trim(), folderId: selectedFolder, timezone, vendorId: userMeta?.vendorId || currentUser?.uid }
        : { name: folderName.trim(), vendorId: userMeta?.vendorId || currentUser?.uid };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        toast.success(`${activeTab} created successfully!`);
        onCreated?.();
        if (isFormPage && onSelectForm) {
          const normalized = { ...result, formId: result._id, id: result._id };
          onSelectForm(normalized);
        }
        onClose();
      } else {
        const errBody = await res.json().catch(() => ({}));
        if (errBody.code === "FORM_LIMIT_REACHED") {
          setFormLimitError(errBody.message || "You have reached your form limit. Please increase your package to add more.");
        } else {
          toast.error(errBody.message || "Could not create");
        }
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  return createPortal(
    <div
      className="modal show d-block afp-create-modal"
      style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 10000 }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "400px", overflow: "visible" }}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: "20px", overflow: "visible" }}>

          {/* Header */}
          <div className="modal-header border-0 p-4 pb-0">
            <div className="d-flex align-items-center">
              <div className="bg-primary p-2 rounded-circle me-3 d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                <LucideIcon name="plus" className="text-white icon-sm" />
              </div>
              <h5 className="modal-title fw-bold text-body mb-0" style={{ fontSize: '17px' }}>Create New...</h5>
            </div>
            <button type="button" className="btn-close shadow-none" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4 pt-3">
            {formLimitError && (
              <div className="alert alert-danger bg-danger-subtle text-danger d-flex align-items-center mb-3 p-3 rounded-3 border border-danger-subtle shadow-sm flex-wrap gap-2" style={{ fontSize: '13px', fontWeight: '500' }}>
                <div className="d-flex align-items-center mb-1 w-100">
                  <LucideIcon name="alert-circle" className="icon-sm me-2 flex-shrink-0" />
                  <span>{formLimitError}</span>
                </div>
                <button className="btn btn-sm btn-danger py-1 px-3 mt-1" onClick={() => navigate('/pricing')} style={{ borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                  Upgrade Plan
                </button>
              </div>
            )}
            {/* Tabs */}
            <div className="d-flex mb-4 bg-light p-1" style={{ borderRadius: '10px' }}>
              {["Form", "Folder"].map(tab => (
                <button
                  key={tab}
                  className={`btn btn-sm w-50 border-0 ${activeTab === tab ? "bg-white shadow-sm fw-bold text-primary" : "text-muted"}`}
                  onClick={() => setActiveTab(tab)}
                  style={{ borderRadius: '8px', height: '36px', fontSize: '13px' }}
                >
                  {tab === "Form" ? "Form Endpoint" : "Folder"}
                </button>
              ))}
            </div>

            {/* Form Content */}
            <div className="tab-content">
              {activeTab === "Form" ? (
                <>
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-muted mb-2 tracking-wide">CHOOSE FOLDER</label>
                    <select
                      className="form-select shadow-none"
                      value={selectedFolder}
                      onChange={e => setSelectedFolder(e.target.value)}
                      style={{ height: '42px', borderRadius: '8px', fontSize: '13.5px', border: '1px solid #e1e8ed' }}
                    >
                      <option value="">Select a folder...</option>
                      {folders.map((f) => {
                        const id = normalizeMongoId(f._id);
                        return id ? (
                          <option key={id} value={id}>
                            {f.name}
                          </option>
                        ) : null;
                      })}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-muted mb-2 tracking-wide">FORM ENDPOINT NAME</label>
                    <input
                      type="text"
                      className="form-control shadow-none"
                      placeholder="e.g. support-request"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      style={{ height: '42px', borderRadius: '8px', fontSize: '13.5px', border: '1px solid #e1e8ed' }}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-bold text-muted mb-2 tracking-wide">TIMEZONE</label>
                    <TimezonePicker value={timezone} onChange={setTimezone} />
                  </div>
                </>
              ) : isFolderLimitReached ? (
                <div className="p-3 border rounded shadow-sm" style={{ borderColor: '#d8b4fe', backgroundColor: '#ffffff' }}>
                  <div className="d-flex align-items-center mb-2">
                    <LucideIcon name="briefcase" className="me-2 flex-shrink-0" style={{ color: '#9333ea', width: '18px', height: '18px' }} />
                    <span className="fw-bold" style={{ color: '#9333ea', fontSize: '14px' }}>Available on the next plan</span>
                  </div>
                  <p className="text-muted mb-3" style={{ fontSize: '13px', lineHeight: 1.4 }}>
                    Upgrade your plan to create more workspaces and collaborate with your team.
                  </p>
                  <button
                    className="btn btn-sm text-white fw-bold px-3 py-2"
                    onClick={() => navigate('/pricing')}
                    style={{ backgroundColor: '#a855f7', borderRadius: '8px' }}
                  >
                    Upgrade Now
                  </button>
                </div>
              ) : (
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted mb-2 tracking-wide">FOLDER NAME</label>
                  <input
                    type="text"
                    className="form-control shadow-none"
                    placeholder="e.g. Marketing Projects"
                    value={folderName}
                    onChange={e => setFolderName(e.target.value)}
                    style={{ height: '42px', borderRadius: '8px', fontSize: '13.5px', border: '1px solid #e1e8ed' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer border-0 p-4 pt-0">
            {!(activeTab === "Folder" && isFolderLimitReached) && (
              <>
                <button type="button" className="btn btn-link text-muted text-decoration-none fw-500 fs-14px" onClick={onClose}>Cancel</button>
                <button
                  className={`btn btn-primary px-4 fw-bold shadow-sm ${!isFormValid ? "opacity-50" : ""}`}
                  disabled={!isFormValid || isCreating}
                  onClick={handleCreate}
                  style={{ borderRadius: '10px', height: '42px', fontSize: '14px' }}
                >
                  {isCreating ? "Creating..." : `Create ${activeTab === "Form" ? "Form" : "Folder"}`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .afp-create-modal { overflow-y: auto; }
        .afp-create-modal .modal-content { overflow: visible; }
        .cursor-pointer { cursor: pointer; }
        .dropdown-item-custom { transition: 0.2s; padding: 10px 16px; width: 100%; border: none; background: none; text-align: left; }
        .dropdown-item-custom:hover { background: #f8f9fa; color: #6571ff; }
        .tracking-wide { letter-spacing: 0.05em; }
        .fw-500 { font-weight: 500; }
      `}</style>
    </div>,
    document.body
  );
}