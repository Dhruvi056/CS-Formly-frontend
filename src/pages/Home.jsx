import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FormDetails from "../components/FormDetails.jsx";
import Sidebar from "../components/Sidebar.jsx";
import AddFormPopup from "../components/AddFormPopup.jsx";
import toast from "react-hot-toast";
import AdminUsersTable from "../components/AdminUsersTable.jsx";
import AdminFormsTable from "../components/AdminFormsTable.jsx";
import Pricing from "./Pricing.jsx";
import SuperAdminDashboard from "../components/SuperAdminDashboard.jsx";

export default function Home() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPricingRoute = location.pathname === "/pricing";

  const [selectedForm, setSelectedForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editJoined, setEditJoined] = useState("");
  const [editLives, setEditLives] = useState("");
  const [editWebsite] = useState("");
  const [editAbout, setEditAbout] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [planHistoryData, setPlanHistoryData] = useState([]);
  const [planHistoryLoading, setPlanHistoryLoading] = useState(false);
  const [usageData, setUsageData] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [smtpList, setSmtpList] = useState([]);
  const [showSMTPModal, setShowSMTPModal] = useState(false);
  
  // SMTP Form State
  const [smtpForm, setSmtpForm] = useState({
    host: "",
    port: "587",
    encryption: "TLS",
    username: "",
    password: "",
    fromName: "",
    fromEmail: "",
    isDefault: true
  });
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [superAdminSection, setSuperAdminSection] = useState(() => {
    if (location.pathname === "/admin/users") return "users";
    if (location.pathname === "/admin/forms") return "forms";
    return "dashboard";
  });
  const [superAdminMetrics, setSuperAdminMetrics] = useState({
    users: 0,
    folders: 0,
    forms: 0,
    plans: { total: 0, counts: { free: 0, pro: 0, business: 0 } },
    usersByPlan: { free: [], pro: [], business: [] },
    signupSeries: [],
  });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [clearNotificationsToken, setClearNotificationsToken] = useState(0);
  const { currentUser, userMeta, logout, updateUserMeta } = useAuth();
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const clearBeforeMsRef = useRef(0);
  const latestByFormRef = useRef({});
  const hasSeededMongoNotificationsRef = useRef(false);

  // --- MongoDB: Keep top-right bell notifications in sync with sidebar ---
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    let intervalId;

    const pollMongoNotifications = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const formsRes = await fetch("/api/forms", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!formsRes.ok) return;
        const forms = await formsRes.json();
        const formIds = forms.map((f) => String(f._id));
        if (formIds.length === 0) return;

        const latestRes = await fetch("/api/submissions/latest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ formIds }),
        });
        const latestData = await latestRes.json().catch(() => ({}));
        if (!latestRes.ok || cancelled) return;

        const latestMap = latestData.result || {};
        const formNameById = {};
        forms.forEach((f) => {
          formNameById[String(f._id)] = f.name || "Form";
        });

        if (!hasSeededMongoNotificationsRef.current) {
          Object.entries(latestMap).forEach(([formId, info]) => {
            latestByFormRef.current[formId] = info?.latestCreatedAtMs || 0;
          });
          hasSeededMongoNotificationsRef.current = true;
          return;
        }

        const incoming = [];
        Object.entries(latestMap).forEach(([formId, info]) => {
          const latestMs = info?.latestCreatedAtMs || 0;
          const prevMs = latestByFormRef.current[formId] || 0;
          if (!latestMs || latestMs <= prevMs) return;
          latestByFormRef.current[formId] = latestMs;

          // If user already viewing same form, do not create bell popup notification
          if (selectedForm?.formId === formId) return;

          incoming.push({
            id: `mongo-${formId}-${info?.latestId || latestMs}-${Date.now()}`,
            formId,
            formName: formNameById[formId] || "Form",
            dataSnippet: "New submission received",
            createdAt: new Date(latestMs),
            read: false,
          });
        });

        if (incoming.length > 0) {
          setNotifications((prev) => [...incoming, ...prev].slice(0, 20));
          setUnreadCount((prev) => prev + incoming.length);
        }
      } catch (err) {
        // noop
      }
    };

    pollMongoNotifications();
    intervalId = setInterval(pollMongoNotifications, 7000);
    const onFocus = () => pollMongoNotifications();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [currentUser, selectedForm?.formId]);

  // --- SYNC ROUTE STATE ---
  const [showProfileView, setShowProfileView] = useState(location.pathname === "/profile");
  const [profileSection, setProfileSection] = useState("account");

  useEffect(() => {
    if (location.pathname === "/profile") {
      setShowProfileView(true);
      setSelectedForm(null);
    } else if (location.pathname.startsWith("/admin")) {
      setShowProfileView(false);
      setSelectedForm(null);
      if (location.pathname === "/admin/users") setSuperAdminSection("users");
      else if (location.pathname === "/admin/forms") setSuperAdminSection("forms");
      else setSuperAdminSection("dashboard");
    } else if (location.pathname.startsWith("/forms")) {
      setShowProfileView(false);
      // selectedForm will be loaded by the form-id effect below
    } else if (location.pathname === "/") {
      setShowProfileView(false);
      setSelectedForm(null);
      if (userMeta?.role === "super_admin") setSuperAdminSection("dashboard");
    }
  }, [location.pathname, userMeta?.role]);

  const fetchUsageData = async () => {
    setUsageLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/billing/usage", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsageData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUsageLoading(false);
    }
  };

  // Fetch data when profile section changes
  useEffect(() => {
    if (!showProfileView) return;
    if (profileSection === "billing") fetchPlanHistory();
    if (profileSection === "usage") fetchUsageData();
    if (profileSection === "smtp") fetchSmtpConfigs();
  }, [profileSection, showProfileView]);

  // --- MONGODB MIGRATION: Fetching Dashboard Metrics ---
  useEffect(() => {
    if (!currentUser || userMeta?.role !== "super_admin") {
      setMetricsLoading(false);
      return;
    }

    const fetchMetrics = async () => {
      setMetricsLoading(true);
      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch("/api/admin/metrics", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSuperAdminMetrics(data);
        }
      } catch (err) {
        console.error("Super admin metrics fetch error:", err);
      } finally {
        setMetricsLoading(false);
      }
    };

    fetchMetrics();
  }, [currentUser, userMeta?.role]);

  // --- MONGODB MIGRATION: Loading Form by ID ---
  useEffect(() => {
    if (!formId || !currentUser) {
      setSelectedForm(null);
      return;
    }

    const loadForm = async () => {
      setLoading(true);
      setShowProfileView(false);
      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`/api/forms/${formId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) {
          navigate("/", { replace: true });
          return;
        }

        const data = await res.json();
        setSelectedForm({ ...data, formId: data._id, id: data._id });
      } catch (error) {
        console.error("Error loading form:", error);
        navigate("/", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadForm();
  }, [formId, currentUser, navigate]);

  const clearAllNotifications = async () => {
    const now = Date.now();
    clearBeforeMsRef.current = now;

    setNotifications([]);
    setUnreadCount(0);
    setShowNotificationMenu(false);
    setClearNotificationsToken((prev) => prev + 1);
  };

  const handleNotificationClick = async (notif) => {
    setShowProfileView(false);
    if (notif.formId) {
      navigate(`/forms/${notif.formId}`, { replace: true });
    }
    await clearAllNotifications();
  };

  const handleNotificationBellClick = async () => {
    if (showNotificationMenu) {
      await clearAllNotifications();
      return;
    }
    setShowNotificationMenu(true);
  };

  const [theme] = useState(localStorage.getItem("theme") || "light");
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (showEditProfile) return;
    if (userMeta?.name) {
      const parts = userMeta.name.split(" ");
      setEditFirstName(parts.shift() || "");
      setEditLastName(parts.join(" ") || "");
    }
    setEditEmail(userMeta?.email || currentUser?.email || "");
  }, [userMeta, showEditProfile]);

  const profileName = userMeta?.name || "User";
  const profileEmail = userMeta?.email || currentUser?.email || "";
  const profileAvatarSrc = userMeta?.photoURL || currentUser?.photoURL || "";
  const profilePlanLabel = String(userMeta?.subscriptionPlan || "free").toUpperCase();
  const planLower = String(userMeta?.subscriptionPlan || "free").toLowerCase();
  const upgradeNavLabel =
    planLower === "business" ? "Business" : `${profilePlanLabel} · Upgrade plan`;

  const fetchSmtpConfigs = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/smtp", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch SMTP configs");
      const data = await res.json();
      setSmtpList(data);
    } catch (err) {
      console.error(err);
      toast.error("Could not load SMTP configurations");
    }
  };

  const handleTestSmtp = async () => {
    if (!smtpForm.host || !smtpForm.port || !smtpForm.username || !smtpForm.password) {
      return toast.error("Please fill in host, port, username, and password to test.");
    }
    setSmtpTesting(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/smtp/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(smtpForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Connection Successful!");
      } else {
        toast.error(data.message || "Connection failed");
      }
    } catch (err) {
      toast.error("An error occurred while testing SMTP");
    } finally {
      setSmtpTesting(false);
    }
  };

  const handleSaveSmtp = async () => {
    const { host, port, username, password, fromName, fromEmail } = smtpForm;
    if (!host || !port || !username || !password || !fromName || !fromEmail) {
      return toast.error("Please fill in all required fields.");
    }
    setSmtpSaving(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/smtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(smtpForm),
      });
      if (res.ok) {
        toast.success("SMTP configuration saved!");
        setShowSMTPModal(false);
        fetchSmtpConfigs();
        // Reset form
        setSmtpForm({
          host: "",
          port: "587",
          encryption: "TLS",
          username: "",
          password: "",
          fromName: "",
          fromEmail: "",
          isDefault: true
        });
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to save SMTP");
      }
    } catch (err) {
      toast.error("An error occurred while saving");
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleDeleteSmtp = async (id) => {
    if (!window.confirm("Are you sure you want to delete this SMTP config?")) return;
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`/api/smtp/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("SMTP config deleted");
        fetchSmtpConfigs();
      } else {
        toast.error("Failed to delete config");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const openProfileView = (section) => {
    setShowProfileMenu(false);
    setShowEditProfile(false);
    setProfileSection(section);
    navigate("/profile");
    if (section === "billing") fetchPlanHistory();
    if (section === "usage") fetchUsageData();
    if (section === "smtp") fetchSmtpConfigs();
  };

  const fetchPlanHistory = async () => {
    setPlanHistoryLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/billing/history", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPlanHistoryData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPlanHistoryLoading(false);
    }
  };

  const LucideIcon = ({ name, className = "", style = {} }) => {
    useEffect(() => {
      if (window.lucide) window.lucide.createIcons();
    }, [name]);
    return (
      <span
        className={`d-flex align-items-center justify-content-center ${className}`}
        style={{ width: "18px", height: "18px", ...style }}
        dangerouslySetInnerHTML={{
          __html: `<i data-lucide="${name}" stroke-width="2"></i>`,
        }}
      />
    );
  };

  const handleSelectForm = (form) => {
    setShowProfileView(false);
    if (form) {
      setSuperAdminSection("dashboard");
      navigate(`/forms/${form.formId}`, { replace: true });
    } else {
      if (userMeta?.role === "super_admin") setSuperAdminSection("dashboard");
      navigate("/", { replace: true });
    }
  };

  const handleFormUpdated = (updates) => {
    setSelectedForm((prev) => (prev ? { ...prev, ...updates } : null));
    if (updates && (
      Object.prototype.hasOwnProperty.call(updates, "folderId") ||
      Object.prototype.hasOwnProperty.call(updates, "name") ||
      updates.refreshUsage === true
    )) {
      setSidebarRefreshKey((k) => k + 1);
    }
  };
  const handleDeleteAccount = async () => {
    try {
      const token = localStorage.getItem("authToken");

      const res = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Delete failed");
      }

      setShowDeleteModal(false);
      toast.success("Account deleted successfully");

      await logout();
      navigate("/login");

    } catch (err) {
      toast.error(err.message || "Error deleting account");
    }
  };

  const handleSelectAdminSection = (section) => {
    if (section === "users") navigate("/admin/users");
    else if (section === "forms") navigate("/admin/forms");
    else navigate("/admin");
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await updateUserMeta({
        name: `${editFirstName} ${editLastName}`.trim(),
        email: editEmail,
        joined: editJoined,
        lives: editLives,
        website: editWebsite,
        about: editAbout,
      });
      // After save, always return to profile view.
      openProfileView();
      toast.success("Profile updated successfully.");
    } catch (err) {
      toast.error("Profile update failed.");
    }
  };
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return toast.error("All fields are required");
    }

    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match");
    }

    try {
      const token = localStorage.getItem("authToken");

      const res = await fetch(`/api/auth/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed");
      }

      toast.success("Password updated successfully");

      setShowPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswords({ current: false, new: false, confirm: false });

    } catch (err) {
      toast.error(err.message || "Error updating password");
    }
  };

  return (
    <div className="main-wrapper">
      <Sidebar
        onSelectForm={handleSelectForm}
        selectedForm={selectedForm}
        onClearAllNotifications={clearAllNotifications}
        clearNotificationsToken={clearNotificationsToken}
        onSelectAdminSection={handleSelectAdminSection}
        activeAdminSection={superAdminSection}
        sidebarRefreshKey={sidebarRefreshKey}
      />
      <div className="page-wrapper">
        <nav className="navbar" style={{ zIndex: 1000 }}>
          <div className="navbar-content">
            <form className="search-form flex-grow-1 mx-4 d-none d-md-block" style={{ maxWidth: '600px' }} onSubmit={(e) => e.preventDefault()}>
              <div
                className="input-group shadow-none border overflow-hidden bg-white"
                style={{ borderRadius: 9999 }}
              >
                <div className="input-group-text border-0 bg-transparent ps-3">
                  <LucideIcon name="search" className="icon-sm text-secondary" />
                </div>
                <input
                  type="text"
                  className="form-control border-0 bg-transparent fs-14px py-2 shadow-none"
                  placeholder="Search submissions or forms"
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                />
              </div>
            </form>

            <ul className="navbar-nav ms-auto flex-row align-items-center">
              {userMeta?.role !== "super_admin" && (
                <li className="nav-item me-2 me-md-3">
                  <Link
                    to="/pricing"
                    className="btn d-flex align-items-center"
                    style={{
                      backgroundColor: "#6571ff",
                      color: "#fff",
                      border: "1px solid #6571ff",
                      borderRadius: "8px",
                      fontWeight: "600",
                      padding: "7px 14px",
                      fontSize: "12px",
                      whiteSpace: "nowrap",
                      boxShadow: "0 2px 4px rgba(101, 113, 255, 0.15)",
                      display: "flex",
                      alignItems: "center"
                    }}
                  >
                    {planLower === "business" ? (
                      <>
                        <LucideIcon name="check-circle" className="icon-sm me-2" />
                        BUSINESS
                      </>
                    ) : (
                      <>
                        <LucideIcon name="arrow-up-circle" className="icon-sm me-2" />
                        {`${profilePlanLabel} · Upgrade to ${planLower === "pro" ? "Business" : "Pro"}`}
                      </>
                    )}
                  </Link>
                </li>
              )}
             

              <li className="nav-item me-3 dropdown px-0" style={{ position: 'relative' }}>
                <button className="nav-link position-relative p-0 d-flex align-items-center border-0 bg-transparent shadow-none" onClick={handleNotificationBellClick} type="button">
                  <LucideIcon name="bell" className="icon-md" />
                  {unreadCount > 0 && (
                    <span className="position-absolute badge rounded-pill bg-success text-white" style={{ top: "-6px", right: "-10px", fontSize: "10px", minWidth: "18px" }}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
                {showNotificationMenu && (
                  <>
                    <div className="dropdown-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1099 }} onClick={() => setShowNotificationMenu(false)}></div>
                    <div className="dropdown-menu show dropdown-menu-end p-0 shadow-lg border-0 animate-fadeIn" style={{ position: 'absolute', top: '50px', right: '-10px', width: '320px', zIndex: 1100, backgroundColor: 'var(--bs-body-bg)', borderRadius: '12px', border: '1px solid var(--bs-border-color)' }}>
                      <div className="p-3 border-bottom d-flex align-items-center justify-content-between bg-body-tertiary rounded-top">
                        <div className="d-flex align-items-center">
                          <LucideIcon name="bell" className="icon-sm me-2 text-primary" />
                          <h6 className="mb-0 fw-bold">Notifications</h6>
                        </div>
                        <span className="badge bg-success text-white rounded-pill small px-2 py-1" style={{ fontSize: "10px" }}>{unreadCount} New</span>
                      </div>
                      <div className="p-0" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center">
                            <LucideIcon name="bell-off" className="text-secondary mb-2 opacity-50" style={{ width: '30px', height: '30px' }} />
                            <p className="small text-muted mb-0">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map(notif => (
                            <button key={notif.id} className="w-100 text-start p-3 border-bottom d-flex align-items-start border-0 bg-transparent" style={{ transition: "background 0.2s", background: notif.read ? "transparent" : "rgba(25, 135, 84, 0.10)" }} onClick={() => handleNotificationClick(notif)} type="button">
                              <div className="bg-primary-subtle p-2 rounded-circle me-3"><LucideIcon name="mail" className="icon-sm text-primary" /></div>
                              <div className="flex-grow-1">
                                <p className="mb-0 fs-13px fw-bold text-body">{notif.formName}</p>
                                <p className="mb-1 fs-12px text-muted text-truncate" style={{ maxWidth: '180px' }}>{notif.dataSnippet}</p>
                                <p className="mb-0 fs-11px text-secondary">Just now</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                      <div className="p-2 text-center border-top">
                        <button className="btn btn-link text-primary fs-12px fw-bold p-0 text-decoration-none" onClick={clearAllNotifications} type="button">View all notifications</button>
                      </div>
                    </div>
                  </>
                )}
              </li>
              <li className="nav-item dropdown px-0" style={{ position: 'relative' }}>
                <button className="nav-link p-0 d-flex align-items-center border-0 bg-transparent shadow-none" onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); }} type="button">
                  <div className="rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center border" style={{ width: '38px', height: '38px', overflow: 'hidden' }}>
                    {profileAvatarSrc ? <img src={profileAvatarSrc} alt="profile" className="w-100 h-100 object-fit-cover" /> : <LucideIcon name="user" className="icon-sm text-primary" />}
                  </div>
                </button>
                {showProfileMenu && (
                  <>
                    <div className="dropdown-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1099 }} onClick={() => setShowProfileMenu(false)}></div>
                    <div
                      className="dropdown-menu show dropdown-menu-end p-0 shadow-lg border-0 animate-fadeIn"
                      style={{
                        position: 'fixed',
                        top: '50px',
                        right: '8px',
                        width: '280px',
                        maxWidth: 'calc(100vw - 16px)',
                        zIndex: 1100,
                        backgroundColor: "var(--bs-body-bg)",
                        borderRadius: "12px",
                        border: "1px solid var(--bs-border-color)",
                        overflow: "hidden",
                        opacity: 1
                      }}
                    >
                      <div className="p-4 border-bottom text-center bg-body-tertiary rounded-top">
                        <div className="mb-3 d-inline-block">
                          <div className="rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center border border-4 border-body shadow-sm mx-auto" style={{ width: '80px', height: '80px', overflow: 'hidden' }}>
                            {profileAvatarSrc ? <img src={profileAvatarSrc} alt="profile" className="w-100 h-100 object-fit-cover" /> : <LucideIcon name="user" style={{ width: '40px', height: '40px' }} className="text-primary" />}
                          </div>
                        </div>
                        <h6 className="fw-bold mb-1 text-body">{profileName}</h6>
                        <p className="small text-muted mb-0">{profileEmail}</p>
                        {userMeta?.role !== "super_admin" && (
                          <div
                            className="badge bg-success-subtle text-success mt-1 px-3 rounded-pill text-uppercase"
                            style={{ fontSize: "10px", letterSpacing: "0.5px" }}
                          >
                            {profilePlanLabel}
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        {/* Account */}
                        <button
                          className="dropdown-item py-2 px-3 rounded d-flex align-items-center border-0 bg-transparent w-100 mb-1"
                          onClick={() => openProfileView("account")}
                          type="button"
                        >
                          <LucideIcon name="user" className="icon-sm me-3 text-secondary" />
                          <span className="fs-14px fw-medium">Account</span>
                        </button>

                        {/* Logout */}
                        <button
                          className="dropdown-item py-2 px-3 rounded d-flex align-items-center border-0 bg-transparent w-100"
                          onClick={async () => {
                            try {
                              toast.success("Goodbye! Signed out successfully.");
                              await logout();
                              navigate("/login");
                            } catch (err) {
                              toast.error("Logout failed.");
                            }
                          }}
                          type="button"
                        >
                          <LucideIcon name="log-out" className="icon-sm me-3 text-danger" />
                          <span className="fs-14px fw-medium text-danger">Log Out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            </ul>
          </div>
        </nav>

        <div className="page-content container-xxl">
          {loading ? (
            <div className="d-flex align-items-center justify-content-center h-100 py-5">
              <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
            </div>
          ) : isPricingRoute ? (
            <Pricing />
          ) : showProfileView ? (
            <div className="py-3">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-0">
                  <div className="row g-0">
                    <div className="col-12 col-md-3 border-end">
                      <div className="p-3">
                        <button
                          type="button"
                          className={`w-100 text-start mb-2 d-flex align-items-center gap-2 ${profileSection === "account"
                            ? "bg-light fw-semibold"
                            : "bg-transparent text-secondary"
                            }`}
                          style={{
                            border: "none",
                            borderRadius: "6px",
                            padding: "10px 12px",
                            lineHeight: "1"
                          }}
                          onClick={() => setProfileSection("account")}
                        >
                          <LucideIcon name="user" className="icon-sm" />
                          <span>Account</span>
                        </button>
                        {userMeta?.role !== "super_admin" && (
                          <>
                            <button
                              type="button"
                              className={`w-100 text-start mb-2 d-flex align-items-center gap-2 ${profileSection === "billing"
                                ? "bg-light fw-semibold"
                                : "bg-transparent text-secondary"
                                }`}
                              style={{
                                border: "none",
                                borderRadius: "6px",
                                padding: "10px 12px",
                                lineHeight: "1"
                              }}
                              onClick={() => {
                                setProfileSection("billing");
                                fetchPlanHistory();
                              }}
                            >
                              <LucideIcon name="credit-card" className="icon-sm" />
                              <span>Billing</span>
                            </button>
                          </>)}
                        {userMeta?.role !== "super_admin" && (
                          <>
                            <button
                              type="button"
                              className={`w-100 text-start d-flex align-items-center gap-2 ${profileSection === "usage"
                                ? "bg-light fw-semibold"
                                : "bg-transparent text-secondary"
                                }`}
                              style={{
                                border: "none",
                                borderRadius: "6px",
                                padding: "10px 12px",
                                lineHeight: "1"
                              }}
                              onClick={() => {
                                setProfileSection("usage");
                                fetchUsageData();
                              }}
                            >
                              <LucideIcon name="activity" className="icon-sm" />
                              <span>Usage</span>
                            </button>
                            <button
                              type="button"
                              className={`w-100 text-start mb-2 d-flex align-items-center gap-2 ${profileSection === "smtp"
                                ? "bg-light fw-semibold"
                                : "bg-transparent text-secondary"
                                }`}
                              style={{
                                border: "none",
                                borderRadius: "6px",
                                padding: "10px 12px",
                              }}
                              onClick={() => setProfileSection("smtp")}
                            >
                              <LucideIcon name="server" className="icon-sm" />
                              <span>SMTP Configurations</span>
                            </button>

                          </>)}
                      </div>
                    </div>
                    <div className="col-12 col-md-9">
                      <div className="p-3">
                        {profileSection === "account" && (
                          <form onSubmit={handleUpdateProfile}>
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <h6 className="mb-0 fw-bold">Account</h6>
                              <span className="badge bg-primary-subtle text-primary text-uppercase" style={{ fontSize: "10px" }}>{profilePlanLabel}</span>
                            </div>
                            <div className="row g-2" style={{ maxWidth: '800px' }}>
                              <div className="col-md-6">
                                <label className="form-label fw-semibold small mb-1">First Name</label>
                                <input type="text" className="form-control form-control-sm" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} required />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label fw-semibold small mb-1">Last Name</label>
                                <input type="text" className="form-control form-control-sm" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} required />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label fw-semibold small mb-1">Email</label>
                                <input type="email" className="form-control form-control-sm" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label fw-semibold small mb-1">Joined</label>
                                <input type="text" className="form-control form-control-sm" value={editJoined} />
                              </div>
                            </div>
                            <div className="mt-3 d-flex gap-2">
                              <button
                                type="submit"
                                className="btn text-white"
                                style={{ backgroundColor: "#6571ff", border: "1px solid #6571ff", borderRadius: "6px", fontWeight: "500", padding: "0.35rem 1rem", fontSize: "0.85rem" }}
                              >
                                Save Changes
                              </button>

                              <button
                                type="button"
                                className="btn bg-transparent"
                                onClick={() => setShowPasswordModal(true)}
                                style={{ color: "#6571ff", border: "1px solid #6571ff", borderRadius: "6px", fontWeight: "500", padding: "0.35rem 1rem", fontSize: "0.85rem" }}
                              >
                                Change Password
                              </button>
                              <button
                                type="button"
                                className="btn"
                                onClick={() => setShowDeleteModal(true)}
                                style={{
                                  color: "#dc2626",
                                  border: "1px solid #dc2626",
                                  borderRadius: "6px",
                                  fontWeight: "500",
                                  padding: "0.35rem 1rem",
                                  fontSize: "0.85rem",
                                  marginLeft: "auto"
                                }}
                              >
                                Delete Account
                              </button>
                              {showDeleteModal && (
                                <div
                                  className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                                  style={{ background: "rgba(0,0,0,0.5)", zIndex: 2000 }}
                                  onClick={() => setShowDeleteModal(false)}
                                >
                                  <div
                                    className="bg-white p-4 rounded shadow"
                                    style={{ width: "400px" }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <h5 className="mb-3 fw-bold text-danger">Delete Account</h5>

                                    <p className="text-muted small">
                                      This action is permanent. All your data, forms, and submissions will be deleted.
                                    </p>

                                    <div className="d-flex justify-content-end gap-2 mt-4">
                                      <button
                                        type="button"
                                        className="btn"
                                        onClick={() => setShowDeleteModal(false)}
                                        style={{
                                          border: "1px solid #6571ff",
                                          color: "#6571ff",
                                          borderRadius: "6px"
                                        }}
                                      >
                                        Cancel
                                      </button>

                                      <button
                                        type="button"
                                        className="btn text-white"
                                        onClick={handleDeleteAccount}
                                        style={{
                                          backgroundColor: "#dc2626",
                                          border: "1px solid #dc2626",
                                          borderRadius: "6px"
                                        }}
                                      >
                                        Delete Permanently
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </form>
                        )}
                        {profileSection === "billing" && (
                          <div>
                            <h6 className="mb-3 fw-bold">Billing</h6>

                            <div className="border rounded-3 p-2 mb-3 d-flex align-items-center justify-content-between bg-white shadow-sm" style={{ maxWidth: '800px' }}>
                              <span className="fw-medium text-secondary small">Current plan</span>
                              <div className="d-flex align-items-center">
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: "#e5e7eb",
                                    color: "#374151",
                                    borderRadius: "6px",
                                    padding: "4px 10px",
                                    fontWeight: "500",
                                    fontSize: "12px"
                                  }}
                                >
                                  {`${String(userMeta?.subscriptionPlan || "free").charAt(0).toUpperCase()}${String(userMeta?.subscriptionPlan || "free").slice(1).toLowerCase()} Plan`}
                                </span>
                                <Link
                                  to="/pricing"
                                  className="btn d-flex align-items-center"
                                  style={{
                                    backgroundColor: "#6571ff",
                                    color: "#fff",
                                    border: "1px solid #6571ff",
                                    borderRadius: "6px",
                                    fontWeight: "500",
                                    padding: "5px 12px",
                                    fontSize: "12px",
                                    marginLeft: "10px"
                                  }}
                                >
                                  <LucideIcon name="arrow-up-circle" className="icon-sm me-2" />
                                  {userMeta?.subscriptionPlan === "pro" ? "Upgrade to Business" : "Upgrade to Pro"}
                                </Link>
                              </div>
                            </div>

                            <h6 className="fw-bold mb-2 fs-14px">Billing History</h6>
                            {planHistoryLoading ? (
                              <div className="text-center py-4"><div className="spinner-border text-primary" role="status" /></div>
                            ) : planHistoryData.length === 0 ? (
                              <p className="text-muted mb-0">No plan history found.</p>
                            ) : (
                              <ul className="list-group list-group-flush">
                                {[...planHistoryData].reverse().map((record, i) => (
                                  <li key={i} className="list-group-item px-0 py-3">
                                    <div className="d-flex justify-content-between align-items-center">
                                      <div>
                                        <h6 className="mb-1 text-capitalize fw-bold">{record.plan} Plan</h6>
                                        <small className="text-muted">{new Date(record.date).toLocaleDateString()}</small>
                                      </div>
                                      <span className="badge bg-success-subtle text-success">${record.amount} {record.currency?.toUpperCase()}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        {profileSection === "usage" && (
                          <div>
                            <h6 className="mb-4 fw-bold">Usage</h6>
                            {usageLoading ? (
                              <div className="text-center py-4"><div className="spinner-border text-primary" role="status" /></div>
                            ) : usageData ? (
                              <div className="bg-white p-3 rounded-3 shadow-sm border" style={{ maxWidth: '800px' }}>
                                {(() => {
                                  const formatBytes = (bytes) => {
                                    if (bytes === 0) return '0 Bytes';
                                    const k = 1024;
                                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                                  };

                                  const renderBar = (title, used, max, isBytes = false) => {
                                    const maxDisplay = max === undefined || max === null ? "∞" : max;
                                    const maxNum = maxDisplay === "∞" ? Infinity : max;
                                    let percent = 0;
                                    if (maxNum !== Infinity && maxNum > 0) percent = (used / maxNum) * 100;
                                    const displayPercent = maxNum === Infinity ? "0.0" : Math.min(percent, 100).toFixed(1);

                                    const usedText = isBytes ? formatBytes(used) : used;
                                    const maxText = isBytes ? (maxNum === Infinity ? "∞" : formatBytes(maxNum)) : maxDisplay;

                                    let barClass = "bg-primary";
                                    if (percent >= 90) barClass = "bg-danger";
                                    else if (percent >= 75) barClass = "bg-warning";

                                    return (
                                      <div className="mb-2">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                          <span className="fw-bold fs-13px text-dark">{title}</span>
                                          <span className="text-secondary small fw-medium bg-light px-2 py-0 rounded" style={{ fontSize: "11px" }}>{usedText} / {maxText}</span>
                                        </div>
                                        <div className="progress mb-1" style={{ height: "6px", borderRadius: "10px", backgroundColor: "#f1f5f9" }}>
                                          <div className={`progress-bar ${barClass}`} role="progressbar" style={{ width: `${maxNum === Infinity ? 0 : Math.min(percent, 100)}%`, borderRadius: "10px" }} aria-valuenow={Math.min(percent, 100)} aria-valuemin="0" aria-valuemax="100"></div>
                                        </div>
                                        <div className="text-secondary small" style={{ fontSize: "11px" }}>{displayPercent}% used</div>
                                      </div>
                                    );
                                  };

                                  return (
                                    <div className="d-flex flex-column gap-2">
                                      {renderBar("File Upload Storage", usageData.usage?.storageBytes || 0, usageData.limits?.maxStorageBytes, true)}
                                      {renderBar("Forms", usageData.usage?.forms || 0, usageData.limits?.maxForms)}
                                      {renderBar("Submissions", usageData.usage?.submissions || 0, usageData.limits?.maxSubmissions)}
                                      {renderBar("Folders", usageData.usage?.folders || 0, usageData.limits?.maxFolders)}
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <p className="text-muted mb-0">Usage data not available.</p>
                            )}
                          </div>
                        )}
                        {profileSection === "smtp" && (
                          <div>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <h5 className="fw-bold">SMTP Configs</h5>

                              <button
                                className="btn text-white"
                                style={{
                                  backgroundColor: "#6571ff",
                                  borderRadius: "6px",
                                }}
                                onClick={() => setShowSMTPModal(true)}
                              >
                                + Add SMTP Server
                              </button>
                            </div>

                            {smtpList.length === 0 ? (
                              <div className="d-flex flex-column align-items-center justify-content-center py-4 px-4 border rounded-4 bg-white shadow-sm mt-2" style={{ minHeight: '220px', maxWidth: '800px' }}>
                                <h6 className="fw-bold text-dark mb-1">No SMTP Configurations Found</h6>
                                <p className="text-secondary mx-auto mb-0" style={{ maxWidth: '450px', fontSize: '13px', lineHeight: '1.4' }}>
                                  Add your first SMTP server to start sending branded emails.
                                </p>
                              </div>
                            ) : (
                              <div className="row g-3">
                                {smtpList.map((smtp, i) => (
                                  <div key={smtp._id || i} className="col-md-6">
                                    <div className="card border shadow-none h-100">
                                      <div className="card-body p-3">
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                          <div className="d-flex align-items-center gap-2">
                                            <div className="bg-primary-subtle p-2 rounded">
                                              <LucideIcon name="server" className="text-primary icon-sm" />
                                            </div>
                                            <div className="fw-bold text-dark">{smtp.fromName}</div>
                                          </div>
                                          <div className="d-flex gap-1">
                                            {smtp.isDefault && (
                                              <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill">Default</span>
                                            )}
                                            <button 
                                              onClick={() => handleDeleteSmtp(smtp._id)}
                                              className="btn btn-link p-0 text-danger opacity-75 hover-opacity-100"
                                            >
                                              <LucideIcon name="trash-2" className="icon-sm" />
                                            </button>
                                          </div>
                                        </div>
                                        <div className="small text-secondary mb-1">
                                          <LucideIcon name="mail" className="icon-xs me-1" /> {smtp.fromEmail}
                                        </div>
                                        <div className="small text-muted font-monospace">
                                          {smtp.host}:{smtp.port} ({smtp.encryption})
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          ) : userMeta?.role === "super_admin" && !selectedForm ? (
            superAdminSection === "users" ? <AdminUsersTable searchQuery={globalSearchQuery} /> :
              superAdminSection === "forms" ? <AdminFormsTable searchQuery={globalSearchQuery} /> :
                (
                  <SuperAdminDashboard
                    metrics={superAdminMetrics}
                    loading={metricsLoading}
                    onGoUsers={() => handleSelectAdminSection("users")}
                    onGoForms={() => handleSelectAdminSection("forms")}
                  />
                )
          ) : !selectedForm ? (
            <div className="d-flex justify-content-center align-items-center py-4" style={{ minHeight: "68vh" }}>
              <div
                className="bg-white"
                style={{
                  width: "100%",
                  maxWidth: 430,
                  borderRadius: 10,
                  padding: "1.5rem",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "20px" }}>
                  <span style={{ fontSize: "30px", fontWeight: "700", color: "rgb(0, 8, 101)" }} >CS</span>

                  <span style={{ fontSize: "30px", fontWeight: "100", color: "#6571ff", marginLeft: "10px" }}>
                    Formly
                  </span>
                </div>

                <div className="d-flex flex-column gap-1">
                  <button
                    type="button"
                    className="nav-link btn btn-link w-100 text-start border-0 d-flex align-items-center gap-2 py-2"
                    onClick={() => setShowCreatePopup(true)}
                    style={{ color: "#4d5969", textDecoration: "none" }}
                  >
                    <LucideIcon name="plus-circle" className="link-icon" />
                    <span className="link-title">Create...</span>
                  </button>

                  <button
                    type="button"
                    className="nav-link btn btn-link w-100 text-start border-0 d-flex align-items-center gap-2 py-2"
                    onClick={() => navigate("/profile")}
                    style={{ color: "#4d5969", textDecoration: "none" }}
                  >
                    <LucideIcon name="user-circle-2" className="link-icon" />
                    <span className="link-title">Account</span>
                  </button>

                  <button
                    type="button"
                    className="nav-link btn btn-link w-100 text-start border-0 d-flex align-items-center gap-2 py-2"
                    onClick={() => navigate("/pricing")}
                    style={{ color: "#4d5969", textDecoration: "none" }}
                  >
                    <LucideIcon name="crown" className="link-icon" />
                    <span className="link-title">{upgradeNavLabel}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <FormDetails form={selectedForm} onFormUpdated={handleFormUpdated} searchQuery={globalSearchQuery} />
          )}
        </div>
      </div>
      {showPasswordModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: "rgba(0,0,0,0.5)", zIndex: 2000 }}
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            className="bg-white p-4 rounded shadow"
            style={{ width: "400px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h5 className="mb-0 fw-bold">Change Password</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => setShowPasswordModal(false)}
              />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleChangePassword();
              }}
            >
              <div className="mb-3">
                <label className="form-label fw-semibold text-secondary small mb-1">Current Password</label>
                <div className="position-relative">
                  <input
                    type={showPasswords.current ? "text" : "password"}
                    placeholder="Current Password"
                    className="form-control pe-5"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility("current")}
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-secondary p-0 me-3"
                    style={{ zIndex: 10 }}
                  >
                    <LucideIcon name={showPasswords.current ? "eye-off" : "eye"} className="icon-sm" />
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold text-secondary small mb-1">New Password</label>
                <div className="position-relative">
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    placeholder="New Password"
                    className="form-control pe-5"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility("new")}
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-secondary p-0 me-3"
                    style={{ zIndex: 10 }}
                  >
                    <LucideIcon name={showPasswords.new ? "eye-off" : "eye"} className="icon-sm" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold text-secondary small mb-1">Confirm Password</label>
                <div className="position-relative">
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    placeholder="Confirm Password"
                    className="form-control pe-5"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility("confirm")}
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-secondary p-0 me-3"
                    style={{ zIndex: 10 }}
                  >
                    <LucideIcon name={showPasswords.confirm ? "eye-off" : "eye"} className="icon-sm" />
                  </button>
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn bg-transparent"
                  onClick={() => setShowPasswordModal(false)}
                  style={{ color: "#6571ff", border: "1px solid #6571ff", borderRadius: "6px", fontWeight: "500", padding: "0.45rem 1.25rem" }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn text-white"
                  style={{ backgroundColor: "#6571ff", border: "1px solid #6571ff", borderRadius: "6px", fontWeight: "500", padding: "0.45rem 1.25rem" }}
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSMTPModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: "12px", overflow: "hidden" }}>
              <div className="modal-header border-0 pb-0 pt-3 px-4 d-flex justify-content-between align-items-start">
                <div>
                  <h6 className="fw-bold mb-0" style={{ color: "#1e293b", fontSize: "1rem" }}>Add SMTP Configuration</h6>
                  <p className="text-secondary mb-0" style={{ fontSize: "0.75rem" }}>Configure personal SMTP settings</p>
                </div>
                <button type="button" className="btn-close shadow-none" style={{ padding: "0.5rem" }} onClick={() => setShowSMTPModal(false)}></button>
              </div>
              
              <div className="modal-body px-4 py-4">
                <div className="mb-2">
                  <label className="form-label fw-semibold small mb-1" style={{ color: "#334155" }}>SMTP Host <span className="text-danger">*</span></label>
                  <input 
                    type="text" 
                    className="form-control shadow-none" 
                    placeholder="smtp.gmail.com" 
                    value={smtpForm.host}
                    onChange={(e) => setSmtpForm({...smtpForm, host: e.target.value})}
                    style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }} 
                  />
                </div>
                
                <div className="row mb-2">
                  <div className="col-6">
                    <label className="form-label fw-semibold small mb-1" style={{ color: "#334155" }}>Port <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      className="form-control shadow-none" 
                      placeholder="587" 
                      value={smtpForm.port}
                      onChange={(e) => setSmtpForm({...smtpForm, port: e.target.value})}
                      style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }} 
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold small mb-1" style={{ color: "#334155" }}>Encryption</label>
                    <select 
                      className="form-select shadow-none" 
                      value={smtpForm.encryption}
                      onChange={(e) => setSmtpForm({...smtpForm, encryption: e.target.value})}
                      style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
                    >
                      <option value="TLS">TLS</option>
                      <option value="SSL">SSL</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                </div>

                <div className="row mb-2">
                  <div className="col-6">
                    <label className="form-label fw-semibold small mb-1" style={{ color: "#334155" }}>Username <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      className="form-control shadow-none" 
                      placeholder="your-email@gmail.com" 
                      value={smtpForm.username}
                      onChange={(e) => setSmtpForm({...smtpForm, username: e.target.value})}
                      style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }} 
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold small mb-1" style={{ color: "#334155" }}>Password <span className="text-danger">*</span></label>
                    <input 
                      type="password" 
                      className="form-control shadow-none" 
                      placeholder="Your email password" 
                      value={smtpForm.password}
                      onChange={(e) => setSmtpForm({...smtpForm, password: e.target.value})}
                      style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }} 
                    />
                  </div>
                </div>

                <div className="row mb-2">
                  <div className="col-6">
                    <label className="form-label fw-semibold small mb-1" style={{ color: "#334155" }}>From Name <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      className="form-control shadow-none" 
                      placeholder="Your Name" 
                      value={smtpForm.fromName}
                      onChange={(e) => setSmtpForm({...smtpForm, fromName: e.target.value})}
                      style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }} 
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold small mb-1" style={{ color: "#334155" }}>From Email <span className="text-danger">*</span></label>
                    <input 
                      type="email" 
                      className="form-control shadow-none" 
                      placeholder="noreply@domain.com" 
                      value={smtpForm.fromEmail}
                      onChange={(e) => setSmtpForm({...smtpForm, fromEmail: e.target.value})}
                      style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }} 
                    />
                  </div>
                </div>

                <div className="alert d-flex flex-column gap-1 py-1 px-3 mb-0" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", color: "#b45309", borderRadius: "6px" }}>
                  <div className="d-flex align-items-center">
                    <LucideIcon name="alert-circle" className="icon-xs me-2 flex-shrink-0" />
                    <span style={{ fontSize: "0.75rem" }}>You must test the SMTP configuration before saving.</span>
                  </div>
                  <div className="d-flex align-items-center">
                    <LucideIcon name="info" className="icon-xs me-2 flex-shrink-0" />
                    <span style={{ fontSize: "0.75rem" }}>Note: Make sure to set a <strong>Notification Email</strong> in your form settings for this to take effect.</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer border-0 px-4 pb-3 pt-0 d-flex justify-content-end gap-2">
                <button 
                  type="button" 
                  className="btn bg-white shadow-sm d-flex align-items-center gap-1" 
                  onClick={handleTestSmtp}
                  disabled={smtpTesting}
                  style={{ border: "1px solid #e2e8f0", color: "#334155", fontWeight: "500", borderRadius: "6px", padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                >
                  {smtpTesting ? "Testing..." : "Test SMTP"}
                </button>
                <button 
                  type="button" 
                  className="btn bg-white shadow-sm" 
                  onClick={() => setShowSMTPModal(false)} 
                  style={{ border: "1px solid #e2e8f0", color: "#334155", fontWeight: "500", padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn text-white shadow-sm" 
                  onClick={handleSaveSmtp}
                  disabled={smtpSaving}
                  style={{ backgroundColor: "#6366f1", border: "1px solid #6366f1", borderRadius: "6px", fontWeight: "500", padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                >
                  {smtpSaving ? "Saving..." : "Save Now"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreatePopup && (
        <AddFormPopup
          onClose={() => setShowCreatePopup(false)}
          onSelectForm={handleSelectForm}
          onCreated={() => setSidebarRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}


