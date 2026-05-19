import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { normalizeMongoId } from "../utils/mongoIds.js";
import "../styles/components/form-details-toolbar.css";

// ── Quill Formats ──────────────────────────────────────────────────────────
const quillFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "blockquote",
  "list",
  "bullet",
  "link",
  "image",
];

function isProbablyFileFieldName(fieldName) {
  const lowerField = (fieldName || "").toLowerCase();
  return (
    lowerField.includes("file") ||
    lowerField.includes("attachment") ||
    lowerField.includes("resume") ||
    lowerField.includes("document") ||
    lowerField.includes("upload")
  );
}

function looksLikeUrl(v) {
  if (typeof v !== "string") return false;
  const lower = v.toLowerCase().trim();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return true;
  // Catch common domains if they look like a path
  return (
    lower.includes("linkedin.com/") ||
    lower.includes("github.com/") ||
    lower.includes("portfolio") ||
    lower.includes("behance.net/") ||
    lower.includes("dribbble.com/") ||
    /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i.test(lower)
  );
}

function looksLikeFileName(v) {
  if (typeof v !== "string") return false;
  return /\.(pdf|doc|docx|xls|xlsx|csv|txt|png|jpe?g|gif|zip|rar|webp)$/i.test(v.trim());
}

function looksLikeEmail(v) {
  if (typeof v !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function getFileLinks(fieldName, value) {
  const links = [];

  const push = (v) => {
    if (!v) return;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (looksLikeUrl(trimmed)) {
        let url = trimmed;
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          url = `https://${url}`;
        }
        const label = (() => {
          try {
            const u = new URL(url);
            const last = (u.pathname || "").split("/").filter(Boolean).pop();
            return last || "link";
          } catch {
            return "link";
          }
        })();
        links.push({ url, label });
        return;
      }
      if (looksLikeEmail(trimmed)) {
        links.push({ url: `mailto:${trimmed}`, label: trimmed });
        return;
      }
      if (looksLikeFileName(trimmed) || isProbablyFileFieldName(fieldName)) {
        links.push({ url: "", label: trimmed });
      }
      return;
    }

    if (typeof v === "object") {
      const url = v.url || v.href || v.link;
      if (looksLikeUrl(url)) {
        links.push({ url, label: v.name || v.fileName || "View file" });
      }
    }
  };

  if (Array.isArray(value)) value.forEach(push);
  else push(value);

  const seen = new Set();
  return links.filter((l) => {
    const k = `${l.url}__${l.label}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Helper: Format complex values for display ──────────────────────────────
function renderFieldValue(val) {
  if (val == null || val === "") return "-";
  if (typeof val === "object") {
    if (Array.isArray(val)) {
      return val.map(v => typeof v === "object" ? JSON.stringify(v) : String(v)).join(", ");
    }
    try {
      const entries = Object.entries(val);
      if (entries.length > 0) {
        return entries
          .map(([k, v]) => {
            const vStr = typeof v === "object" ? JSON.stringify(v) : v;
            return `${k}: ${vStr}`;
          })
          .join(", ");
      }
      return JSON.stringify(val);
    } catch (e) {
      return String(val);
    }
  }
  return String(val);
}

function parseJsonSafe(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeSubmissionData(rawData) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return {};
  }

  const next = { ...rawData };
  const payload = parseJsonSafe(next.payload);

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const payloadData = parseJsonSafe(payload.data);
    if (payloadData && typeof payloadData === "object" && !Array.isArray(payloadData)) {
      return payloadData;
    }
  }

  return next;
}

// ── Helper: get first letter initial from email ──────────────────────────────
function getEmailInitial(email) {
  if (!email) return "?";
  return email.charAt(0).toUpperCase();
}

// ── Helper: deterministic color from initial letter ───────────────────────────
function getInitialColor(letter) {
  const colors = [
    "#4F46E5", "#0891B2", "#059669", "#D97706",
    "#DC2626", "#7C3AED", "#DB2777", "#EA580C",
  ];
  return colors[(letter || "A").charCodeAt(0) % colors.length];
}

export default function FormDetails({ form, onFormUpdated, searchQuery = "" }) {
  const { currentUser, userMeta } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [showEmailModal, setShowEmailModal] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("modal") === "email";
  });
  const [emailModalTab, setEmailModalTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "notifications";
  });
  const [emailInput, setEmailInput] = useState("");
  const [emailsList, setEmailsList] = useState([]);
  const [ccEmailInput, setCcEmailInput] = useState("");
  const [ccEmailsList, setCcEmailsList] = useState([]);

  const [customTemplateDraft, setCustomTemplateDraft] = useState({
    enabled: false,
    body: "",
  });
  const [autoresponderDraft, setAutoresponderDraft] = useState({
    enabled: false,
    subject: "",
    body: "",
    attachmentUrl: "",
    attachmentName: "",
    attachmentRules: [],
  });
  const [isHtmlMode, setIsHtmlMode] = useState(false);

  // Body scroll lock when email modal is open
  useEffect(() => {
    if (showEmailModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [showEmailModal]);

  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const selectAllRef = useRef(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [folders, setFolders] = useState([]);
  const [allForms, setAllForms] = useState([]);
  const [moveFolderId, setMoveFolderId] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [emailSettingsSaving, setEmailSettingsSaving] = useState(false);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const quillRef = useRef(null);
  const autoresponderQuillRef = useRef(null);

  const imageHandler = useCallback(async (refOrQuill) => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;

      // Check file size (e.g., 5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image too large (max 5MB)");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const loadingToast = toast.loading("Uploading image...");
      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (res.ok) {
          const { url } = await res.json();
          const quill = refOrQuill.current ? refOrQuill.current.getEditor() : refOrQuill;
          const range = quill.getSelection();
          quill.insertEmbed(range.index, "image", url);
          toast.success("Image uploaded!");
        } else {
          const errData = await res.json().catch(() => ({}));
          toast.error(errData.error || errData.message || "Upload failed.");
        }
      } catch (err) {
        toast.error("Error uploading image.");
      } finally {
        toast.dismiss(loadingToast);
      }
    };
  }, []);

  const memoQuillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, false] }],
        ["bold", "italic", "underline", "strike", "blockquote"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image"],
        ["clean"],
      ],
      handlers: {
        image: () => imageHandler(quillRef),
      },
    },
  }), [imageHandler]);

  const memoAutoresponderQuillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, false] }],
        ["bold", "italic", "underline", "strike", "blockquote"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image"],
        ["clean"],
      ],
      handlers: {
        image: () => imageHandler(autoresponderQuillRef),
      },
    },
  }), [imageHandler]);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("authToken");
      const headers = { Authorization: `Bearer ${token}` };
      const [foldersRes, formsRes] = await Promise.all([
        fetch("/api/folders", { headers }),
        fetch("/api/forms", { headers }),
      ]);
      if (foldersRes.ok) {
        const data = await foldersRes.json();
        setFolders(data.map((f) => ({ ...f, id: f._id })));
      }
      if (formsRes.ok) {
        const data = await formsRes.json();
        setAllForms(data.map((f) => ({ ...f, formId: f._id, id: f._id })));
      }
    } catch (err) {
      console.error("Error fetching dependencies:", err);
    }
  }, []);

  useEffect(() => {
    if (currentUser) fetchData();
  }, [currentUser, fetchData]);

  const fetchSubmissions = useCallback(async () => {
    if (!form?.formId) return;
    setLoadingSubmissions(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("Session expired. Please log in again.");
        setSubmissions([]);
        return;
      }
      const res = await fetch(`/api/submissions/${form.formId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          body?.message ||
          (res.status === 401 ? "Unauthorized. Please log in again." : "Failed to load submissions.");
        toast.error(msg);
        return;
      }

      const rows = Array.isArray(body)
        ? body
        : Array.isArray(body?.submissions)
          ? body.submissions
          : Array.isArray(body?.data)
            ? body.data
            : [];

      setSubmissions(
        rows.map((s) => ({
          ...s,
          id: s._id ?? s.id,
          submittedAt: new Date(s.createdAt || s.submittedAt || s.timestamp || Date.now()).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
        }))
      );
    } catch (err) {
      console.error("Error fetching submissions:", err);
      toast.error("Error fetching submissions.");
    } finally {
      setLoadingSubmissions(false);
    }
  }, [form?.formId]);

  useEffect(() => {
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 7000);
    const onFocus = () => fetchSubmissions();
    const onVisible = () => { if (!document.hidden) fetchSubmissions(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchSubmissions]);

  useEffect(() => {
    if (!form) return;
    setRenameDraft(form.name || "");
    setMoveFolderId(normalizeMongoId(form.folderId) || "");
    setIsEditingName(false);
    const emailStr = form.settings?.notificationEmail || "";
    setEmailsList(
      emailStr
        ? emailStr.split(/[,;\n]+/).map((e) => e.trim()).filter(Boolean)
        : []
    );
    const ccEmailStr = form.settings?.ccNotificationEmail || "";
    setCcEmailsList(
      ccEmailStr
        ? ccEmailStr.split(/[,;\n]+/).map((e) => e.trim()).filter(Boolean)
        : []
    );
    setCustomTemplateDraft({
      enabled: form.settings?.customTemplateEnabled || false,
      body: form.settings?.customTemplateBody || "",
    });
    setAutoresponderDraft({
      enabled: form.settings?.autoresponderEnabled || false,
      subject: form.settings?.autoresponderSubject || "Thank you! Your submission has been received!",
      body: form.settings?.autoresponderBody || "Thank you for your submission. Your response has been received successfully.",
      attachmentUrl: form.settings?.autoresponderAttachmentUrl || "",
      attachmentName: form.settings?.autoresponderAttachmentName || "",
      attachmentRules: Array.isArray(form.settings?.autoresponderAttachmentRules)
        ? form.settings.autoresponderAttachmentRules.map((rule) => ({
          key: rule?.key || "",
          attachmentUrl: rule?.attachmentUrl || "",
          attachmentName: rule?.attachmentName || "",
          subject: rule?.subject || "",
          body: rule?.body || "",
        }))
        : [],
    });
  }, [form]);

  const isNameTaken = (name, excludeFormId) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return false;
    return (
      allForms.some(
        (f) =>
          f.formId !== excludeFormId &&
          (f.name || "").trim().toLowerCase() === normalized
      ) || folders.some((f) => (f.name || "").trim().toLowerCase() === normalized)
    );
  };

  const handleSaveRename = async () => {
    if (!form?.formId) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) { toast.error("Please enter a form name."); return; }
    if (isNameTaken(trimmed, form.formId)) { toast.error("Name already used."); return; }
    if (trimmed === (form.name || "").trim()) { setIsEditingName(false); return; }
    setRenameSaving(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`/api/forms/${form.formId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        onFormUpdated?.({ name: trimmed });
        toast.success("Name updated.");
        setIsEditingName(false);
      }
    } catch (err) {
      toast.error("Update failed.");
    } finally {
      setRenameSaving(false);
    }
  };

  const handleSaveMove = async () => {
    if (!form?.formId) return;
    const nextId = moveFolderId ? String(moveFolderId) : "";
    setMoveSaving(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`/api/forms/${form.formId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ folderId: nextId || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        const fid = normalizeMongoId(updated.folderId);
        onFormUpdated?.({ folderId: fid ? fid : null });
        await fetchData();
        toast.success(nextId ? "Moved to folder." : "Moved to direct forms.");
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody.message || "Move failed.");
      }
    } catch (err) {
      toast.error("Move failed.");
    } finally {
      setMoveSaving(false);
    }
  };

  const saveEmailSettings = async () => {
    if (!form?.formId) return;
    setEmailSettingsSaving(true);
    try {
      const token = localStorage.getItem("authToken");
      const emailStr = emailsList.join(", ");
      const ccEmailStr = ccEmailsList.join(", ");
      const res = await fetch(`/api/forms/${form.formId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          settings: {
            notificationEmail: emailStr,
            ccNotificationEmail: ccEmailStr,
            customTemplateEnabled: customTemplateDraft.enabled,
            customTemplateBody: customTemplateDraft.body,
            autoresponderEnabled: autoresponderDraft.enabled,
            autoresponderSubject: autoresponderDraft.subject,
            autoresponderBody: autoresponderDraft.body,
            autoresponderAttachmentUrl: autoresponderDraft.attachmentUrl,
            autoresponderAttachmentName: autoresponderDraft.attachmentName,
            autoresponderAttachmentRules: (autoresponderDraft.attachmentRules || [])
              .map((rule) => ({
                key: String(rule?.key || "").trim(),
                attachmentUrl: String(rule?.attachmentUrl || "").trim(),
                attachmentName: String(rule?.attachmentName || "").trim(),
                subject: String(rule?.subject || "").trim(),
                body: String(rule?.body || "").trim(),
              }))
              .filter((rule) => rule.key && (rule.attachmentUrl || rule.subject || rule.body)),
          },
        }),
      });
      if (res.ok) {
        onFormUpdated?.({
          settings: {
            ...form.settings,
            notificationEmail: emailStr,
            ccNotificationEmail: ccEmailStr,
            customTemplateEnabled: customTemplateDraft.enabled,
            customTemplateBody: customTemplateDraft.body,
            autoresponderEnabled: autoresponderDraft.enabled,
            autoresponderSubject: autoresponderDraft.subject,
            autoresponderBody: autoresponderDraft.body,
            autoresponderAttachmentUrl: autoresponderDraft.attachmentUrl,
            autoresponderAttachmentName: autoresponderDraft.attachmentName,
            autoresponderAttachmentRules: (autoresponderDraft.attachmentRules || [])
              .map((rule) => ({
                key: String(rule?.key || "").trim(),
                attachmentUrl: String(rule?.attachmentUrl || "").trim(),
                attachmentName: String(rule?.attachmentName || "").trim(),
                subject: String(rule?.subject || "").trim(),
                body: String(rule?.body || "").trim(),
              }))
              .filter((rule) => rule.key && (rule.attachmentUrl || rule.subject || rule.body)),
          },
        });
        await fetchData();
        setShowEmailModal(false);
        toast.success("Email settings saved.");
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody.message || "Failed to save settings");
      }
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setEmailSettingsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDeleteIds?.length) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem("authToken");
      const ids = pendingDeleteIds;
      const res =
        ids.length === 1
          ? await fetch(`/api/submissions/${ids[0]}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            })
          : await fetch("/api/submissions/bulk-delete", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ ids }),
            });

      if (res.ok) {
        const removed = new Set(ids);
        setSubmissions((prev) => prev.filter((s) => !removed.has(s.id)));
        setSelectedIds((prev) => prev.filter((id) => !removed.has(id)));
        setPendingDeleteIds(null);
        toast.success(
          ids.length === 1 ? "Deleted successfully." : `${ids.length} submissions deleted.`
        );
        onFormUpdated?.({ refreshUsage: true });
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody.message || "Delete failed.");
      }
    } catch (err) {
      toast.error("Delete failed.");
    } finally {
      setIsDeleting(false);
    }
  };

  const addEmail = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { toast.error("Invalid email"); return; }
    if (emailsList.includes(trimmed)) { toast.error("Email already added"); return; }
    setEmailsList([...emailsList, trimmed]);
    setEmailInput("");
  };

  const addCcEmail = () => {
    const trimmed = ccEmailInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { toast.error("Invalid email"); return; }
    if (ccEmailsList.includes(trimmed)) { toast.error("Email already added to CC"); return; }
    setCcEmailsList([...ccEmailsList, trimmed]);
    setCcEmailInput("");
  };

  const removeEmail = (idx) => {
    setEmailsList(emailsList.filter((_, i) => i !== idx));
  };

  const removeCcEmail = (idx) => {
    setCcEmailsList(ccEmailsList.filter((_, i) => i !== idx));
  };

  const LucideIcon = ({ name, className = "", style, ...rest }) => {
    useEffect(() => {
      if (window.lucide) window.lucide.createIcons();
    }, [name]);
    return (
      <span
        className={`d-inline-flex align-items-center justify-content-center ${className}`.trim()}
        style={style}
        {...rest}
        dangerouslySetInnerHTML={{ __html: `<i data-lucide="${name}" stroke-width="2"></i>` }}
      />
    );
  };

  const normalizedSubmissions = useMemo(
    () =>
      submissions.map((s) => ({
        ...s,
        data: normalizeSubmissionData(s.data),
      })),
    [submissions]
  );

  const allFields = new Set();
  normalizedSubmissions.forEach((s) => {
    if (s.data) Object.keys(s.data).forEach((f) => allFields.add(f));
  });
  const fields = Array.from(allFields).filter((f) => {
    const lower = f.toLowerCase();
    return (
      f !== "_gotcha" &&
      lower !== "cf-turnstile-response" &&
      lower !== "g-recaptcha-response"
    );
  });

  const openFile = async (url, fallbackLabel, submissionId, fieldName) => {
    try {
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      const fileName = String(fallbackLabel || "").trim();
      if (!fileName) { toast.error("File name missing."); return; }
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/submissions/resolve-file", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ formId: form?.formId, fileName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.message || "File not found."); return; }
      if (data.url) { window.open(data.url, "_blank", "noopener,noreferrer"); return; }
      toast.error("File URL not available.");
    } catch (err) {
      toast.error("Failed to open file.");
    }
  };

  const filteredSubmissions = useMemo(() => {
    if (!searchQuery) return normalizedSubmissions;
    const s = searchQuery.toLowerCase();
    return normalizedSubmissions.filter((sub) => {
      const matchInFields = fields.some((f) =>
        String(sub.data?.[f] || "").toLowerCase().includes(s)
      );
      return matchInFields || sub.submittedAt.toLowerCase().includes(s);
    });
  }, [normalizedSubmissions, searchQuery, fields]);

  const visibleSubmissionIds = useMemo(
    () => filteredSubmissions.map((s) => s.id),
    [filteredSubmissions]
  );

  const allVisibleSelected =
    visibleSubmissionIds.length > 0 &&
    visibleSubmissionIds.every((id) => selectedIds.includes(id));

  const someSelected = selectedIds.length > 0;

  useEffect(() => {
    setSelectedIds([]);
  }, [form?.formId]);

  useEffect(() => {
    const visible = new Set(visibleSubmissionIds);
    setSelectedIds((prev) => prev.filter((id) => visible.has(id)));
  }, [visibleSubmissionIds]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allVisibleSelected;
    }
  }, [someSelected, allVisibleSelected]);

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visible = new Set(visibleSubmissionIds);
      setSelectedIds((prev) => prev.filter((id) => !visible.has(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleSubmissionIds])]);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const ownerEmail = userMeta?.email || currentUser?.email || "";
  const ownerInitial = getEmailInitial(ownerEmail);
  const ownerColor = getInitialColor(ownerInitial);

  if (!form) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center h-100 py-5 opacity-50">
        <LucideIcon name="inbox" style={{ width: "64px", height: "64px" }} className="mb-3" />
        <h4>Select a form to view submissions</h4>
      </div>
    );
  }

  return (
    <div className="row h-100 flex-column">
      <div className="col-md-12 mb-4">
        <div className="fd-form-toolbar">
          <div className="fd-form-toolbar-accent" />
          <div className="fd-form-toolbar-body">
            <div className="fd-toolbar-top">
              <span className="fd-id-chip">ID · {form.formId}</span>
              <button
                type="button"
                onClick={() => {
                  setEmailModalTab("notifications");
                  setShowEmailModal(true);
                  navigate(`${location.pathname}?modal=email&tab=notifications`, { replace: true });
                }}
                className="btn fd-btn-notify"
              >
                <LucideIcon name="mail" className="icon-sm me-1" />
                <span>Notification email</span>
              </button>
            </div>

            <div className="fd-pro-grid">
              <div className="fd-pro-panel">
                <div className="fd-pro-panel-head">
                  <span className="fd-pro-panel-title">Display name</span>
                </div>
                {isEditingName ? (
                  <div className="fd-pro-rename-row">
                    <input
                      type="text"
                      className="form-control"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      autoFocus
                    />
                    <div className="fd-pro-rename-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveRename}
                        disabled={renameSaving}
                      >
                        Save
                      </button>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => setIsEditingName(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="fd-pro-heading-row">
                    <h4 className="fd-pro-heading mb-0">{form.name}</h4>
                    <button
                      className="fd-pro-edit-btn"
                      onClick={() => setIsEditingName(true)}
                    >
                      <LucideIcon name="pencil" className="icon-sm" />
                    </button>
                  </div>
                )}
              </div>

              <div className="fd-pro-panel">
                <div className="fd-pro-panel-head">
                  <span className="fd-pro-panel-title">Folder location</span>
                </div>
                <div className="fd-pro-folder-row">
                  <select
                    className="form-select form-select-sm"
                    value={moveFolderId}
                    onChange={(e) => setMoveFolderId(e.target.value)}
                  >
                    <option value="">None (direct)</option>
                    {folders.map((fol) => {
                      const oid = normalizeMongoId(fol._id ?? fol.id);
                      return oid ? (
                        <option key={oid} value={oid}>
                          {fol.name}
                        </option>
                      ) : null;
                    })}
                  </select>
                  <button
                    className="btn btn-primary btn-sm ms-2"
                    onClick={handleSaveMove}
                    disabled={moveSaving}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            <div className="fd-pro-url mt-3">
              <span className="fd-pro-url-label">Endpoint URL</span>
              <div className="fd-pro-url-inner">
                <code className="fd-pro-url-text">
                  {form.url || `${window.location.origin}/api/forms/${form.formId}`}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      form.url || `${window.location.origin}/api/forms/${form.formId}`
                    )
                  }
                  className="btn fd-pro-url-copy"
                >
                  <LucideIcon
                    name={copied ? "check" : "copy"}
                    className={`icon-sm ${copied ? "text-success" : "text-primary"}`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-12 flex-grow-1 overflow-hidden d-flex flex-column">
        <div className="card shadow-sm border-0 flex-grow-1 overflow-hidden">
          <div className="card-body d-flex flex-column">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="card-title mb-0">
                  Submissions ({filteredSubmissions.length})
                </h6>
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={fetchSubmissions}
                disabled={loadingSubmissions}
              >
                {loadingSubmissions ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {someSelected && (
              <div
                className="d-flex align-items-center gap-3 mb-3 px-3 py-2 rounded-3 fd-submissions-bulk-bar"
                role="toolbar"
                aria-label="Bulk actions"
              >
                <span className="small fw-semibold text-secondary">
                  {selectedIds.length} selected
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-danger p-0 d-inline-flex align-items-center gap-1 text-decoration-none"
                  onClick={() => setPendingDeleteIds([...selectedIds])}
                  title="Delete selected"
                >
                  <LucideIcon name="trash-2" className="icon-sm" />
                  Delete
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-secondary p-0 text-decoration-none ms-auto"
                  onClick={() => setSelectedIds([])}
                >
                  Clear selection
                </button>
              </div>
            )}

            {submissions.length === 0 ? (
              <div
                className="d-flex flex-column align-items-center justify-content-center flex-grow-1 py-5 text-muted"
                style={{ minHeight: 200 }}
              >
                <LucideIcon
                  name="inbox"
                  className="mb-3 opacity-25"
                  style={{ width: 56, height: 56 }}
                />
                <p className="mb-0 small">No submissions yet</p>
              </div>
            ) : (
              <div className="table-responsive flex-grow-1">
                <table className="table table-hover align-middle">
                  <thead className="bg-light sticky-top" style={{ zIndex: 5 }}>
                    <tr>
                      <th className="text-center" style={{ width: 44 }}>
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="form-check-input"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          disabled={filteredSubmissions.length === 0}
                          aria-label="Select all submissions"
                        />
                      </th>
                      {fields.map((f) => (
                        <th
                          key={f}
                          className="text-uppercase small fw-bold text-secondary"
                        >
                          {f}
                        </th>
                      ))}
                      <th className="text-uppercase small fw-bold text-secondary">
                        Date
                      </th>
                      <th className="text-uppercase small fw-bold text-secondary text-end">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((sub) => (
                      <tr
                        key={sub.id}
                        className={selectedIds.includes(sub.id) ? "table-primary" : undefined}
                      >
                        <td className="text-center">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={selectedIds.includes(sub.id)}
                            onChange={() => toggleSelectOne(sub.id)}
                            aria-label={`Select submission ${sub.id}`}
                          />
                        </td>
                        {fields.map((f) => {
                          const val = sub.data?.[f];
                          const fileLinks = getFileLinks(f, val);
                          const hasDownloadable = fileLinks.some((l) => !!l.url);
                          const shouldRenderAsFile =
                            fileLinks.length > 0 &&
                            (isProbablyFileFieldName(f) ||
                              looksLikeFileName(String(val || "")) ||
                              hasDownloadable);
                          return (
                            <td key={f} className="small">
                              {shouldRenderAsFile ? (
                                <div className="d-flex flex-column gap-1">
                                  {fileLinks.slice(0, 2).map((l, idx) => (
                                    <button
                                      key={`${l.url || l.label}-${idx}`}
                                      type="button"
                                      className="btn btn-link p-0 text-start text-decoration-none fw-normal"
                                      onClick={() =>
                                        openFile(l.url, l.label, sub.id, f)
                                      }
                                      style={{ fontSize: 13, maxWidth: 120, fontWeight: 400 }}
                                      title={
                                        l.url
                                          ? "Open / Link"
                                          : "No URL saved for this file"
                                      }
                                    >
                                      <span
                                        className="text-truncate d-inline-block align-bottom"
                                        style={{ maxWidth: 120, fontWeight: 400 }}
                                      >
                                        {l.label}
                                      </span>
                                    </button>
                                  ))}
                                  {fileLinks.length > 2 && (
                                    <span className="text-muted" style={{ fontSize: 12 }}>
                                      +{fileLinks.length - 2} more
                                    </span>
                                  )}
                                </div>
                              ) : (
                                renderFieldValue(val)
                              )}
                            </td>
                          );
                        })}
                        <td className="small text-muted">{sub.submittedAt}</td>
                        <td className="text-end">
                          <div className="d-inline-flex align-items-center gap-1">
                            <button
                              className="btn btn-sm p-1 text-primary"
                              onClick={() => setViewingSubmission(sub)}
                            >
                              <LucideIcon name="eye" className="icon-sm" />
                            </button>
                            <button
                              className="btn btn-sm p-1 text-danger"
                              onClick={() => setPendingDeleteIds([sub.id])}
                            >
                              <LucideIcon name="trash-2" className="icon-sm" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Submission Detail Modal ── */}
      {viewingSubmission &&
        createPortal(
          <div
            className="modal show d-block"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", zIndex: 12000 }}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
              style={{ maxWidth: 640 }}
            >
              <div
                className="modal-content border-0 shadow-lg"
                style={{ borderRadius: 16, overflow: "hidden" }}
              >
                <div className="modal-header border-0 px-4 pt-4 pb-2 bg-body-tertiary">
                  <div>
                    <h5 className="modal-title fw-bold mb-1">Submission Details</h5>
                    <div className="small text-muted">
                      Submitted at {viewingSubmission.submittedAt}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setViewingSubmission(null)}
                    aria-label="Close"
                  />
                </div>
                <div className="modal-body px-3 py-2">
                  <div className="row g-2">
                    {fields.map((f) => {
                      const val = viewingSubmission.data?.[f];
                      const fileLinks = getFileLinks(f, val);
                      return (
                        <div className="col-md-6" key={f}>
                          <label className="form-label small fw-bold text-uppercase text-secondary mb-1">
                            {f}
                          </label>
                          <div
                            className="rounded-3 border bg-body p-3"
                            style={{ minHeight: 54 }}
                          >
                            {fileLinks.length > 0 ? (
                              <div className="d-flex flex-wrap gap-2">
                                {fileLinks.map((l, idx) => (
                                  <button
                                    key={`${l.url || l.label}-${idx}`}
                                    type="button"
                                    className="btn btn-link btn-sm p-0 text-decoration-none fw-normal"
                                    style={{ fontWeight: 400, fontSize: 13 }}
                                    onClick={() =>
                                      openFile(
                                        l.url,
                                        l.label,
                                        viewingSubmission.id,
                                        f
                                      )
                                    }
                                  >
                                    {l.label}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="small">{renderFieldValue(val) || "—"}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="modal-footer border-0 px-4 pb-4 pt-0">
                  <button
                    type="button"
                    className="btn btn-light px-4"
                    onClick={() => setViewingSubmission(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── Email Settings Modal (Merged) ── */}
      {showEmailModal &&
        createPortal(
          <div
            className="modal show d-block fd-email-modal-backdrop"
            style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 11000 }}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
              style={{ maxWidth: 700 }}
            >
              <div
                className="modal-content border-0 shadow-lg"
                style={{ borderRadius: 14 }}
              >
                {/* Header with Tabs */}
                <div className="modal-header border-0 pb-0 pt-4 px-4 flex-column align-items-stretch">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <div className="d-flex gap-3 align-items-center">
                      <div
                        className="rounded-circle bg-primary d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
                        style={{ width: 42, height: 42, background: "#4F46E5" }}
                      >
                        <LucideIcon
                          name="mail"
                          className="text-white"
                          style={{ width: 20, height: 20 }}
                        />
                      </div>
                      <h5 className="modal-title fw-bold mb-0" style={{ fontSize: 18, color: "#111827" }}>
                        Email Settings
                      </h5>
                    </div>
                    <button
                      type="button"
                      className="btn border-0 p-1 opacity-50 hover-opacity-100 position-absolute"
                      onClick={() => {
                        setShowEmailModal(false);
                        navigate(location.pathname, { replace: true });
                      }}
                      style={{ transition: "opacity 0.2s", top: "20px", right: "20px" }}
                    >
                      <LucideIcon name="x" style={{ width: 22, height: 22 }} />
                    </button>
                  </div>

                  <ul className="nav nav-tabs border-bottom-0 gap-4" style={{ fontSize: 15 }}>
                    <li className="nav-item">
                      <button
                        className={`nav-link border-0 px-0 py-2 ${emailModalTab === "notifications" ? "active fw-bold text-primary" : "text-muted fw-medium"}`}
                        onClick={() => {
                          setEmailModalTab("notifications");
                          navigate(`${location.pathname}?modal=email&tab=notifications`, { replace: true });
                        }}
                        style={{
                          background: "transparent",
                          color: emailModalTab === "notifications" ? "#4F46E5" : "#6b7280",
                          borderBottom: emailModalTab === "notifications" ? "2px solid #4F46E5" : "none",
                          borderRadius: 0
                        }}
                      >
                        Notifications
                      </button>
                    </li>

                    {userMeta?.subscriptionPlan === "business" && (
                      <li className="nav-item">
                        <button
                          className={`nav-link border-0 px-0 py-2 ${emailModalTab === "customTemplate" ? "active fw-bold text-primary" : "text-muted fw-medium"}`}
                          onClick={() => {
                            setEmailModalTab("customTemplate");
                            navigate(`${location.pathname}?modal=email&tab=customTemplate`, { replace: true });
                          }}
                          style={{
                            background: "transparent",
                            color: emailModalTab === "customTemplate" ? "#4F46E5" : "#6b7280",
                            borderBottom: emailModalTab === "customTemplate" ? "2px solid #4F46E5" : "none",
                            borderRadius: 0
                          }}
                        >
                          Custom Template
                        </button>
                      </li>
                    )}

                    {(userMeta?.subscriptionPlan === "business" || userMeta?.subscriptionPlan === "pro") && (
                      <li className="nav-item">
                        <button
                          className={`nav-link border-0 px-0 py-2 ${emailModalTab === "autoresponder" ? "active fw-bold text-primary" : "text-muted fw-medium"}`}
                          onClick={() => {
                            setEmailModalTab("autoresponder");
                            navigate(`${location.pathname}?modal=email&tab=autoresponder`, { replace: true });
                          }}
                          style={{
                            background: "transparent",
                            color: emailModalTab === "autoresponder" ? "#4F46E5" : "#6b7280",
                            borderBottom: emailModalTab === "autoresponder" ? "2px solid #4F46E5" : "none",
                            borderRadius: 0
                          }}
                        >
                          Autoresponder
                        </button>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Body */}
                <div className="modal-body px-4 pt-4 pb-2">
                  {emailModalTab === "notifications" && (
                    <>
                      {/* Main Recipient List */}
                      <div className="mb-4">
                        <label className="form-label mb-2 text-uppercase text-secondary fw-bold" style={{ fontSize: 10, letterSpacing: "0.05em" }}>
                          Recipient List (Main)
                        </label>
                        <div className="d-flex flex-column gap-2 mb-3">
                          {emailsList.length === 0 ? (
                            <div className="rounded-3 bg-light p-3 border-0 text-center text-muted" style={{ fontSize: 13 }}>
                              No main recipients added
                            </div>
                          ) : (
                            emailsList.map((e, i) => {
                              const initial = getEmailInitial(e);
                              const color = getInitialColor(initial);
                              return (
                                <div key={`main-${i}`} className="rounded-3 bg-light p-2 border-0 d-flex align-items-center justify-content-between">
                                  <div className="d-flex align-items-center gap-3">
                                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32, background: color }}>
                                      <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{initial}</span>
                                    </div>
                                    <span style={{ fontSize: 14, color: "#111827" }}>{e}</span>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-link text-danger text-decoration-none p-0 me-2"
                                    style={{ fontSize: 13, fontWeight: 500 }}
                                    onClick={() => removeEmail(i)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <label className="form-label mb-2 text-uppercase text-secondary fw-bold" style={{ fontSize: 10, letterSpacing: "0.05em" }}>
                          Add New Recipient
                        </label>
                        <div className="d-flex gap-2 mb-3">
                          <input
                            type="email"
                            className="form-control"
                            style={{ fontSize: 13, height: 36, background: "#fff", border: "1px solid #e5e7eb" }}
                            placeholder="e.g. notifications@company.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                          />
                          <button
                            type="button"
                            className="btn btn-primary px-3 d-flex align-items-center justify-content-center"
                            style={{ height: 36, background: "#4F46E5", border: "none", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}
                            onClick={addEmail}
                          >
                            + Add
                          </button>
                        </div>

                        <div className="alert alert-info py-2 px-3 mb-4 border-0 d-flex align-items-center gap-2" style={{ fontSize: 12, background: "#E0F2FE", color: "#0369A1", borderRadius: "8px" }}>
                           <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#0369A1" }} />
                           <span>Addresses listed here receive alerts on every new submission.</span>
                        </div>
                      </div>

                      {/* CC Recipient List */}
                      <div className="mb-4">
                        <label className="form-label mb-2 text-uppercase text-secondary fw-bold" style={{ fontSize: 10, letterSpacing: "0.05em" }}>
                          CC Recipient List
                        </label>
                        <div className="d-flex flex-column gap-2 mb-3">
                          {ccEmailsList.length === 0 ? (
                            <div className="rounded-3 bg-light p-3 border-0 text-center text-muted" style={{ fontSize: 13 }}>
                              No CC recipients added
                            </div>
                          ) : (
                            ccEmailsList.map((e, i) => {
                              const initial = getEmailInitial(e);
                              return (
                                <div key={`cc-${i}`} className="rounded-3 bg-light p-2 border-0 d-flex align-items-center justify-content-between">
                                  <div className="d-flex align-items-center gap-3">
                                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32, background: "#64748b" }}>
                                      <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{initial}</span>
                                    </div>
                                    <span style={{ fontSize: 14, color: "#111827" }}>{e}</span>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-link text-danger text-decoration-none p-0 me-2"
                                    style={{ fontSize: 13, fontWeight: 500 }}
                                    onClick={() => removeCcEmail(i)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <label className="form-label mb-2 text-uppercase text-secondary fw-bold" style={{ fontSize: 10, letterSpacing: "0.05em" }}>
                          Add New CC Recipient
                        </label>
                        <div className="d-flex gap-2">
                          <input
                            type="email"
                            className="form-control"
                            style={{ fontSize: 13, height: 36, background: "#fff", border: "1px solid #e5e7eb" }}
                            placeholder="e.g. manager@company.com"
                            value={ccEmailInput}
                            onChange={(e) => setCcEmailInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCcEmail())}
                          />
                          <button
                            type="button"
                            className="btn btn-outline-primary px-3 d-flex align-items-center justify-content-center"
                            style={{ height: 36, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}
                            onClick={addCcEmail}
                          >
                            + Add CC
                          </button>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="form-label mb-2 text-uppercase text-secondary fw-bold" style={{ fontSize: 10, letterSpacing: "0.05em" }}>
                          Owner
                        </label>
                        <div className="rounded-3 bg-light p-3 border-0 d-flex align-items-center gap-3">
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ width: 36, height: 36, background: ownerColor }}
                          >
                            <span style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{ownerInitial}</span>
                          </div>
                          <div className="d-flex flex-column">
                            <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{ownerEmail || "—"}</span>
                            <span style={{ fontSize: 12, color: "#6b7280" }}>Owner</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}


                  {emailModalTab === "customTemplate" && userMeta?.subscriptionPlan === "business" && (
                    <>
                      <div className="form-check form-switch mb-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="customTemplateEnabled"
                          checked={customTemplateDraft.enabled}
                          onChange={(e) =>
                            setCustomTemplateDraft({ ...customTemplateDraft, enabled: e.target.checked })
                          }
                        />
                        <label className="form-check-label small fw-bold" htmlFor="customTemplateEnabled">
                          Enable Custom Template for Notifications
                        </label>
                      </div>

                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="form-label mb-0 text-uppercase text-secondary" style={{ fontSize: 10, fontWeight: 600 }}>
                          Custom HTML Template
                        </label>
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-decoration-none p-0"
                          style={{ fontSize: 11 }}
                          onClick={() => setIsHtmlMode(!isHtmlMode)}
                        >
                          {isHtmlMode ? "Switch to Visual Editor" : "Switch to HTML Code"}
                        </button>
                      </div>

                      <div className="mb-2 fd-quill-container">
                        <style>{`
                          .fd-quill-container .ql-container {
                            height: 180px;
                            border-bottom-left-radius: 8px;
                            border-bottom-right-radius: 8px;
                            font-family: 'Segoe UI', system-ui, sans-serif;
                            font-size: 13px;
                          }
                          .fd-quill-container .ql-toolbar {
                            border-top-left-radius: 8px;
                            border-top-right-radius: 8px;
                            background: #f8fafc;
                          }
                          .fd-quill-container .ql-editor.ql-blank::before {
                            font-style: normal;
                            color: #94a3b8;
                          }
                        `}</style>
                        {isHtmlMode ? (
                          <textarea
                            className="form-control"
                            style={{ height: 223, fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
                            value={customTemplateDraft.body}
                            onChange={(e) => setCustomTemplateDraft({ ...customTemplateDraft, body: e.target.value })}
                            disabled={!customTemplateDraft.enabled}
                            placeholder="Type raw HTML here..."
                          />
                        ) : (
                          <ReactQuill
                            theme="snow"
                            ref={quillRef}
                            value={customTemplateDraft.body}
                            onChange={(content) => setCustomTemplateDraft({ ...customTemplateDraft, body: content })}
                            modules={memoQuillModules}
                            formats={quillFormats}
                            placeholder="Design your notification email template..."
                            readOnly={!customTemplateDraft.enabled}
                          />
                        )}
                      </div>

                      <div className="alert alert-info py-2 px-3 mb-0 mt-2" style={{ fontSize: 11, lineHeight: "1.4", border: "none", background: "#f0f9ff" }}>
                        <div className="d-flex align-items-center gap-1 fw-bold mb-2 text-primary">
                          <LucideIcon name="info" style={{ width: 14, height: 14 }} />
                          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em" }}>Available Placeholders</span>
                        </div>
                        <div className="d-flex flex-wrap gap-2 mb-2">
                          {['{{AllFields}}', '{{FormName}}', '{{DashboardUrl}}', '{{SubmittedAt}}', '{{IpAddress}}'].map(tag => (
                            <code
                              key={tag}
                              className="bg-white border rounded px-1 text-primary"
                              style={{ cursor: "pointer", fontSize: 10 }}
                              onClick={() => {
                                copyToClipboard(tag);
                                toast.success(`Copied ${tag}`);
                              }}
                            >
                              {tag}
                            </code>
                          ))}
                        </div>
                        <div className="text-muted" style={{ fontSize: 10 }}>
                          Tip: Use <code>{`{{FieldName}}`}</code> to insert a specific field value.
                        </div>
                      </div>


                    </>
                  )}


                  {emailModalTab === "autoresponder" && (userMeta?.subscriptionPlan === "business" || userMeta?.subscriptionPlan === "pro") && (
                    <>
                      <div className="form-check form-switch mb-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="autoresponderEnabled"
                          checked={autoresponderDraft.enabled}
                          onChange={(e) =>
                            setAutoresponderDraft({ ...autoresponderDraft, enabled: e.target.checked })
                          }
                        />
                        <label className="form-check-label small fw-bold" htmlFor="autoresponderEnabled">
                          Enable Autoresponder (Thank You Message)
                        </label>
                      </div>

                      <div className="mb-3">
                        <label className="form-label mb-1 text-uppercase text-secondary" style={{ fontSize: 10, fontWeight: 600 }}>
                          Email Subject
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          style={{ fontSize: 12 }}
                          value={autoresponderDraft.subject}
                          onChange={(e) => setAutoresponderDraft({ ...autoresponderDraft, subject: e.target.value })}
                          disabled={!autoresponderDraft.enabled}
                          placeholder="e.g. Thanks for your submission!"
                        />
                      </div>

                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="form-label mb-0 text-uppercase text-secondary" style={{ fontSize: 10, fontWeight: 600 }}>
                          Message Body
                        </label>
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-decoration-none p-0 text-danger"
                          style={{ fontSize: 10, fontWeight: 600 }}
                          onClick={() => {
                            if (window.confirm("Are you sure you want to clear the entire message body?")) {
                              setAutoresponderDraft({ ...autoresponderDraft, body: "" });
                            }
                          }}
                        >
                          Clear Body
                        </button>
                      </div>

                      <div className="alert alert-warning py-2 px-3 mb-2 d-flex align-items-start gap-2" style={{ fontSize: 10, border: "none", background: "#fffbeb", color: "#92400e", borderRadius: "6px" }}>
                        <LucideIcon name="alert-triangle" style={{ width: 12, height: 12, marginTop: 2 }} />
                        <span><strong>Warning:</strong> Adding large images directly can make the email very large, causing it to be "clipped" (hidden) by Gmail. We recommend using smaller images or links.</span>
                      </div>

                      <div className="mb-2 fd-quill-container">
                        <ReactQuill
                          theme="snow"
                          ref={autoresponderQuillRef}
                          value={autoresponderDraft.body}
                          onChange={(content) => setAutoresponderDraft({ ...autoresponderDraft, body: content })}
                          modules={memoAutoresponderQuillModules}
                          formats={quillFormats}
                          placeholder="Type your thank you message here..."
                          readOnly={!autoresponderDraft.enabled}
                        />
                      </div>

                      <div className="alert alert-info py-2 px-3 mb-0 mt-2" style={{ fontSize: 11, lineHeight: "1.4", border: "none", background: "#f0f9ff" }}>
                        <div className="d-flex align-items-center gap-1 fw-bold mb-2 text-primary">
                          <LucideIcon name="info" style={{ width: 14, height: 14 }} />
                          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em" }}>Available Placeholders</span>
                        </div>
                        <div className="d-flex flex-wrap gap-2 mb-2">
                          {['{{AllFields}}', '{{FormName}}', '{{SubmittedAt}}'].map(tag => (
                            <code
                              key={tag}
                              className="bg-white border rounded px-1 text-primary"
                              style={{ cursor: "pointer", fontSize: 10 }}
                              onClick={() => {
                                copyToClipboard(tag);
                                toast.success(`Copied ${tag}`);
                              }}
                            >
                              {tag}
                            </code>
                          ))}
                        </div>
                        <div className="text-muted" style={{ fontSize: 10 }}>
                          Tip: Use <code>{`{{FieldName}}`}</code> to insert a specific field value.
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-top">
                        <label className="form-label mb-1 text-uppercase text-secondary" style={{ fontSize: 10, fontWeight: 600 }}>
                          Default Email Attachment (PDF/Document)
                        </label>
                        <div className="d-flex align-items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                            style={{ fontSize: 11, fontWeight: 600 }}
                            disabled={!autoresponderDraft.enabled}
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = ".pdf,.doc,.docx,.zip";
                              input.onchange = async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;

                                const formData = new FormData();
                                formData.append("file", file);

                                const t = toast.loading("Uploading attachment...");
                                try {
                                  const res = await fetch("/api/upload", {
                                    method: "POST",
                                    headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
                                    body: formData,
                                  });
                                  if (res.ok) {
                                    const { url } = await res.json();
                                    setAutoresponderDraft(prev => ({
                                      ...prev,
                                      attachmentUrl: url,
                                      attachmentName: file.name
                                    }));
                                    toast.success("Attachment added!");
                                  } else {
                                    toast.error("Upload failed.");
                                  }
                                } catch (err) {
                                  toast.error("Upload error.");
                                } finally {
                                  toast.dismiss(t);
                                }
                              };
                              input.click();
                            }}
                          >
                            <LucideIcon name="paperclip" style={{ width: 12, height: 12 }} />
                            {autoresponderDraft.attachmentUrl ? "Change Attachment" : "Attach PDF/File"}
                          </button>

                          {autoresponderDraft.attachmentUrl && (
                            <div className="d-flex align-items-center gap-2 bg-light rounded px-2 py-1 flex-grow-1" style={{ fontSize: 11, minWidth: 0 }}>
                              <LucideIcon name="file-text" className="text-secondary flex-shrink-0" style={{ width: 12, height: 12 }} />
                              <span className="text-truncate text-secondary">{autoresponderDraft.attachmentName || "Attached file"}</span>
                              <button
                                type="button"
                                className="btn btn-link p-0 text-danger ms-auto"
                                onClick={() => setAutoresponderDraft(prev => ({ ...prev, attachmentUrl: "", attachmentName: "" }))}
                              >
                                <LucideIcon name="x" style={{ width: 12, height: 12 }} />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mt-3">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <label className="form-label mb-0 text-uppercase text-secondary" style={{ fontSize: 10, fontWeight: 600 }}>
                              ID based attachments
                            </label>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              style={{ fontSize: 10 }}
                              disabled={!autoresponderDraft.enabled}
                              onClick={() =>
                                setAutoresponderDraft((prev) => ({
                                  ...prev,
                                  attachmentRules: [...(prev.attachmentRules || []), { key: "", attachmentUrl: "", attachmentName: "", subject: "", body: "" }],
                                }))
                              }
                            >
                              + Add ID
                            </button>
                          </div>

                          {(autoresponderDraft.attachmentRules || []).length === 0 ? (
                            <div className="text-muted small">No ID rules added yet.</div>
                          ) : (
                            <div className="d-flex flex-column gap-2">
                              {(autoresponderDraft.attachmentRules || []).map((rule, idx) => (
                                <div key={`rule-${idx}`} className="border rounded p-2 bg-light shadow-sm">
                                  <div className="d-flex gap-2 align-items-center mb-2">
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      placeholder="Enter ID (e.g. JOBID01)"
                                      value={rule.key || ""}
                                      disabled={!autoresponderDraft.enabled}
                                      style={{ fontWeight: 600 }}
                                      onChange={(e) =>
                                        setAutoresponderDraft((prev) => {
                                          const next = [...(prev.attachmentRules || [])];
                                          next[idx] = { ...next[idx], key: e.target.value };
                                          return { ...prev, attachmentRules: next };
                                        })
                                      }
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger"
                                      disabled={!autoresponderDraft.enabled}
                                      onClick={() =>
                                        setAutoresponderDraft((prev) => ({
                                          ...prev,
                                          attachmentRules: (prev.attachmentRules || []).filter((_, i) => i !== idx),
                                        }))
                                      }
                                    >
                                      Remove
                                    </button>
                                  </div>

                                  <div className="mb-2">
                                    <label className="form-label mb-1 text-uppercase text-secondary" style={{ fontSize: 9, fontWeight: 700 }}>
                                      Email Subject for this ID
                                    </label>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      placeholder="Custom subject for this ID..."
                                      value={rule.subject || ""}
                                      disabled={!autoresponderDraft.enabled}
                                      onChange={(e) =>
                                        setAutoresponderDraft((prev) => {
                                          const next = [...(prev.attachmentRules || [])];
                                          next[idx] = { ...next[idx], subject: e.target.value };
                                          return { ...prev, attachmentRules: next };
                                        })
                                      }
                                    />
                                  </div>

                                  <div className="mb-2 fd-quill-container">
                                    <label className="form-label mb-1 text-uppercase text-secondary" style={{ fontSize: 9, fontWeight: 700 }}>
                                      Message Body for this ID
                                    </label>
                                    <ReactQuill
                                      theme="snow"
                                      value={rule.body || ""}
                                      onChange={(content) =>
                                        setAutoresponderDraft((prev) => {
                                          const next = [...(prev.attachmentRules || [])];
                                          next[idx] = { ...next[idx], body: content };
                                          return { ...prev, attachmentRules: next };
                                        })
                                      }
                                      modules={{
                                        toolbar: {
                                          container: [
                                            [{ header: [1, 2, false] }],
                                            ["bold", "italic", "underline", "strike", "blockquote"],
                                            [{ list: "ordered" }, { list: "bullet" }],
                                            ["link", "image"],
                                            ["clean"],
                                          ],
                                          handlers: {
                                            image: function () {
                                              imageHandler(this.quill);
                                            },
                                          },
                                        },
                                      }}
                                      formats={quillFormats}
                                      placeholder="Custom message body..."
                                      readOnly={!autoresponderDraft.enabled}
                                    />
                                    <div className="mt-2 py-1 px-2 rounded" style={{ fontSize: 10, background: "#f0f9ff", border: "1px solid #e0f2fe" }}>
                                      <div className="d-flex align-items-center gap-1 fw-bold mb-1 text-primary">
                                        <LucideIcon name="info" style={{ width: 10, height: 10 }} />
                                        <span style={{ fontSize: 9, textTransform: "uppercase" }}>Placeholders</span>
                                      </div>
                                      <div className="d-flex flex-wrap gap-1">
                                        {['{{AllFields}}', '{{FormName}}', '{{SubmittedAt}}'].map(tag => (
                                          <code
                                            key={tag}
                                            className="bg-white border rounded px-1 text-primary"
                                            style={{ cursor: "pointer", fontSize: 9 }}
                                            onClick={() => {
                                              copyToClipboard(tag);
                                              toast.success(`Copied ${tag}`);
                                            }}
                                          >
                                            {tag}
                                          </code>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="d-flex gap-2 align-items-center">
                                    <button
                                      type="button"
                                      className="btn btn-outline-primary btn-sm"
                                      style={{ fontSize: 10, padding: "2px 8px" }}
                                      disabled={!autoresponderDraft.enabled}
                                      onClick={() => {
                                        const input = document.createElement("input");
                                        input.type = "file";
                                        input.accept = ".pdf,.doc,.docx,.zip";
                                        input.onchange = async (e) => {
                                          const file = e.target.files[0];
                                          if (!file) return;

                                          const formData = new FormData();
                                          formData.append("file", file);

                                          const t = toast.loading("Uploading attachment...");
                                          try {
                                            const res = await fetch("/api/upload", {
                                              method: "POST",
                                              headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
                                              body: formData,
                                            });
                                            if (!res.ok) {
                                              toast.error("Upload failed.");
                                              return;
                                            }
                                            const { url } = await res.json();
                                            setAutoresponderDraft((prev) => {
                                              const next = [...(prev.attachmentRules || [])];
                                              next[idx] = {
                                                ...next[idx],
                                                attachmentUrl: url,
                                                attachmentName: file.name,
                                              };
                                              return { ...prev, attachmentRules: next };
                                            });
                                            toast.success("Attachment added!");
                                          } catch (err) {
                                            toast.error("Upload error.");
                                          } finally {
                                            toast.dismiss(t);
                                          }
                                        };
                                        input.click();
                                      }}
                                    >
                                      {rule.attachmentUrl ? "Change PDF/File" : "Attach PDF/File"}
                                    </button>

                                    <span className="small text-muted text-truncate" style={{ maxWidth: 180, fontSize: 10 }}>
                                      {rule.attachmentName || "No file selected"}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <p className="text-muted mt-2 mb-0" style={{ fontSize: 9 }}>
                          Max size 5MB. If payload has a matching ID, that specific file is sent; otherwise default attachment is used.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="modal-footer border-0 pt-0 pb-3 px-3" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-light"
                    style={{ fontSize: 12, padding: "5px 14px" }}
                    onClick={() => setShowEmailModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: "5px 16px" }}
                    onClick={saveEmailSettings}
                    disabled={emailSettingsSaving}
                  >
                    {emailSettingsSaving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── Delete Confirmation Modal ── */}
      {pendingDeleteIds && pendingDeleteIds.length > 0 && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", zIndex: 12000 }}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: 420 }}
          >
            <div
              className="modal-content border-0 shadow-lg"
              style={{ borderRadius: 16 }}
            >
              <div className="modal-header border-0 pb-0 pt-4 px-4">
                <div className="d-flex gap-3 align-items-start">
                  <div
                    className="rounded-circle bg-danger bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: 44, height: 44 }}
                  >
                    <LucideIcon
                      name="trash-2"
                      className="text-danger"
                      style={{ width: 20, height: 20 }}
                    />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold mb-1">
                      {pendingDeleteIds.length === 1
                        ? "Delete submission?"
                        : `Delete ${pendingDeleteIds.length} submissions?`}
                    </h5>
                    <p className="text-muted small mb-0">
                      {pendingDeleteIds.length === 1
                        ? "This will remove the submission from the list. You can't undo this action."
                        : "These submissions will be removed from the list. You can't undo this action."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn border-0 p-1 opacity-50 hover-opacity-100 position-absolute"
                  aria-label="Close"
                  onClick={() => setPendingDeleteIds(null)}
                  style={{ transition: "opacity 0.2s", top: "15px", right: "15px" }}
                >
                  <LucideIcon name="x" style={{ width: 20, height: 20 }} />
                </button>
              </div>
              <div className="modal-body px-4 pt-3 pb-0">
                <div className="alert alert-warning d-flex gap-2 align-items-start mb-0">
                  <LucideIcon
                    name="alert-triangle"
                    className="flex-shrink-0 mt-1"
                    style={{ width: 16, height: 16 }}
                  />
                  <div className="small">
                    Tip: If you only want to hide it, you can delete now and keep
                    the data in MongoDB (soft delete).
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-3">
                <button
                  className="btn btn-light px-4"
                  onClick={() => setPendingDeleteIds(null)}
                  disabled={isDeleting}
                >
                  No, cancel
                </button>
                <button
                  className="btn btn-danger px-4"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Yes, delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}