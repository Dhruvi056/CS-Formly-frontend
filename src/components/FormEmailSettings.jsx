import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import EmailTemplateEditor from "./email/EmailTemplateEditor";
import EmailTemplatePreviewModal from "./email/EmailTemplatePreviewModal";
import { formbridgeNotificationStarterDesign } from "./email/formbridgeNotificationStarterDesign";
import "../styles/email-settings.css";

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

function getEmailInitial(email) {
  if (!email) return "?";
  return email.charAt(0).toUpperCase();
}

function getInitialColor(letter) {
  const colors = [
    "#184BFB", "#1339C9", "#059669", "#D97706",
    "#DC2626", "#7C3AED", "#DB2777", "#EA580C",
  ];
  return colors[(letter || "A").charCodeAt(0) % colors.length];
}

function LucideIcon({ name, className = "", style, ...rest }) {
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
}

export default function FormEmailSettings({ form, onFormUpdated }) {
  const { currentUser, userMeta } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const formId = form?.formId;

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
    design: null,
  });
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templatePreviewSending, setTemplatePreviewSending] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);
  const emailEditorRef = useRef(null);
  const [autoresponderDraft, setAutoresponderDraft] = useState({
    enabled: false,
    subject: "",
    body: "",
    attachmentUrl: "",
    attachmentName: "",
    attachmentRules: [],
  });
  const [emailSettingsSaving, setEmailSettingsSaving] = useState(false);
  const autoresponderQuillRef = useRef(null);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${text}`);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Could not copy to clipboard");
    }
  };

  const imageHandler = useCallback(async (refOrQuill) => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;

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

  const memoAutoresponderQuillModules = useMemo(
    () => ({
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
    }),
    [imageHandler]
  );

  const ruleQuillModules = useMemo(
    () => ({
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
    }),
    [imageHandler]
  );

  useEffect(() => {
    if (!form) return;
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
      design: form.settings?.customTemplateDesign || null,
    });
    setAutoresponderDraft({
      enabled: form.settings?.autoresponderEnabled || false,
      subject: form.settings?.autoresponderSubject || "Thank you for your submission!",
      body: form.settings?.autoresponderBody || "We have received your submission. Thank you!",
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

  const exportTemplateFromEditor = async () => {
    if (!emailEditorRef.current?.exportHtml) {
      throw new Error("Email editor is not ready");
    }
    return emailEditorRef.current.exportHtml();
  };

  const saveCustomTemplate = async () => {
    if (!formId) return;
    setTemplateSaving(true);
    try {
      const { html, design } = await exportTemplateFromEditor();
      const token = localStorage.getItem("authToken");
      const res = await fetch(`/api/forms/save-template/${formId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customTemplateEnabled: customTemplateDraft.enabled,
          customTemplateBody: html,
          customTemplateDesign: design,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody.message || "Failed to save template");
        return;
      }
      const updated = await res.json();
      setCustomTemplateDraft({
        enabled: updated.settings?.customTemplateEnabled ?? customTemplateDraft.enabled,
        body: updated.settings?.customTemplateBody || html,
        design: updated.settings?.customTemplateDesign || design,
      });
      onFormUpdated?.({
        settings: {
          ...form.settings,
          customTemplateEnabled: updated.settings?.customTemplateEnabled,
          customTemplateBody: updated.settings?.customTemplateBody,
          customTemplateDesign: updated.settings?.customTemplateDesign,
        },
      });
      toast.success("Email template saved. It will be used on the next form submission.");
    } catch (err) {
      toast.error(err.message || "Could not export template from editor");
    } finally {
      setTemplateSaving(false);
    }
  };

  const loadFormbridgeStarterLayout = () => {
    if (!customTemplateDraft.enabled) {
      toast.error("Enable custom template first.");
      return;
    }
    try {
      emailEditorRef.current?.loadDesign?.(formbridgeNotificationStarterDesign);
      toast.success("Starter layout loaded. Edit brand text, then Save template.");
    } catch (err) {
      toast.error("Editor not ready — wait a moment and try again.");
    }
  };

  const previewCustomTemplate = async ({ sendTest = false } = {}) => {
    if (!formId) return;
    try {
      const { html } = await exportTemplateFromEditor();
      const token = localStorage.getItem("authToken");

      if (!sendTest) {
        const res = await fetch(`/api/forms/test-template/${formId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ templateBody: html, sendEmail: false }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.message || "Preview failed");
          return;
        }
        setPreviewHtml(data.html || html);
        return;
      }

      setTemplatePreviewSending(true);
      const res = await fetch(`/api/forms/test-template/${formId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ templateBody: html, sendEmail: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || "Failed to send test email");
        return;
      }
      toast.success(data.message || "Test email sent");
      if (data.html) setPreviewHtml(data.html);
    } catch (err) {
      toast.error(err.message || "Preview failed");
    } finally {
      setTemplatePreviewSending(false);
    }
  };

  const saveEmailSettings = async () => {
    if (!formId) return;
    setEmailSettingsSaving(true);
    try {
      let templateBody = customTemplateDraft.body;
      let templateDesign = customTemplateDraft.design;
      if (customTemplateDraft.enabled && emailEditorRef.current?.exportHtml) {
        try {
          const exported = await exportTemplateFromEditor();
          templateBody = exported.html;
          templateDesign = exported.design;
        } catch (_) {
          /* keep last saved draft if editor not ready */
        }
      }

      const token = localStorage.getItem("authToken");
      const emailStr = emailsList.join(", ");
      const ccEmailStr = ccEmailsList.join(", ");
      const res = await fetch(`/api/forms/${formId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          settings: {
            notificationEmail: emailStr,
            ccNotificationEmail: ccEmailStr,
            customTemplateEnabled: customTemplateDraft.enabled,
            customTemplateBody: templateBody,
            customTemplateDesign: templateDesign,
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
            customTemplateBody: templateBody,
            customTemplateDesign: templateDesign,
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
        toast.success("Email settings saved.");
        navigate(`/forms/${formId}`, { replace: true });
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

  const addEmail = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Invalid email");
      return;
    }
    if (emailsList.includes(trimmed)) {
      toast.error("Email already added");
      return;
    }
    setEmailsList([...emailsList, trimmed]);
    setEmailInput("");
  };

  const addCcEmail = () => {
    const trimmed = ccEmailInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Invalid email");
      return;
    }
    if (ccEmailsList.includes(trimmed)) {
      toast.error("Email already added to CC");
      return;
    }
    setCcEmailsList([...ccEmailsList, trimmed]);
    setCcEmailInput("");
  };

  const removeEmail = (idx) => {
    setEmailsList(emailsList.filter((_, i) => i !== idx));
  };

  const removeCcEmail = (idx) => {
    setCcEmailsList(ccEmailsList.filter((_, i) => i !== idx));
  };

  const ownerEmail = userMeta?.email || currentUser?.email || "";
  const ownerInitial = getEmailInitial(ownerEmail);
  const ownerColor = getInitialColor(ownerInitial);

  const goBackToForm = () => {
    if (formId) navigate(`/forms/${formId}`, { replace: true });
  };

  const setActiveEmailTab = (tab) => {
    setEmailModalTab(tab);
    if (formId) {
      navigate(`/forms/${formId}/email-settings?tab=${tab}`, { replace: true });
    }
  };

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    if (tab && ["notifications", "customTemplate", "autoresponder"].includes(tab)) {
      setEmailModalTab(tab);
    }
  }, [location.search]);

  const plan = userMeta?.subscriptionPlan;
  const showCustomTemplate = plan === "business";
  const showAutoresponder = plan === "business" || plan === "pro";

  return (
    <div className="fd-email-settings-page">
      <div className="fd-email-settings-card fd-email-settings-modal">
        <div className="modal-content border-0 shadow-none">
          <div className="modal-header border-0 pb-0 flex-column align-items-stretch position-relative">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex gap-3 align-items-center">
                <button
                  type="button"
                  className="btn border-0 p-1 fd-email-settings-back"
                  aria-label="Back to form"
                  onClick={goBackToForm}
                >
                  <LucideIcon name="arrow-left" style={{ width: 22, height: 22 }} />
                </button>
                <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center flex-shrink-0 fd-email-settings-icon">
                  <LucideIcon name="mail" className="text-white" style={{ width: 20, height: 20 }} />
                </div>
                <h5 id="email-settings-title" className="modal-title mb-0">
                  Email Settings
                </h5>
              </div>
            </div>

            <div className="fd-email-settings-tabs-wrap">
              <ul className="nav fd-email-settings-tabs">
                <li className="nav-item">
                  <button
                    type="button"
                    className={`fd-email-settings-tab ${emailModalTab === "notifications" ? "active" : ""}`}
                    onClick={() => setActiveEmailTab("notifications")}
                  >
                    Notifications
                  </button>
                </li>
                {showCustomTemplate && (
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`fd-email-settings-tab ${emailModalTab === "customTemplate" ? "active" : ""}`}
                      onClick={() => setActiveEmailTab("customTemplate")}
                    >
                      Custom Template
                    </button>
                  </li>
                )}
                {showAutoresponder && (
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`fd-email-settings-tab ${emailModalTab === "autoresponder" ? "active" : ""}`}
                      onClick={() => setActiveEmailTab("autoresponder")}
                    >
                      Autoresponder
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="modal-body">
            {emailModalTab === "notifications" && (
              <>
                <div className="mb-4">
                  <label className="form-label fd-email-field-label">Recipient List (Main)</label>
                  <div className="d-flex flex-column gap-2 mb-3">
                    {emailsList.length === 0 ? (
                      <div className="rounded-3 fd-email-recipient-card p-3 text-center text-muted" style={{ fontSize: 13 }}>
                        No main recipients added
                      </div>
                    ) : (
                      emailsList.map((e, i) => {
                        const initial = getEmailInitial(e);
                        const color = getInitialColor(initial);
                        return (
                          <div
                            key={`main-${i}`}
                            className="rounded-3 fd-email-recipient-card p-2 d-flex align-items-center justify-content-between"
                          >
                            <div className="d-flex align-items-center gap-3">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{ width: 32, height: 32, background: color }}
                              >
                                <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{initial}</span>
                              </div>
                              <span style={{ fontSize: 14, color: "var(--brand-dark)" }}>{e}</span>
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

                  <label className="form-label fd-email-field-label">Add New Recipient</label>
                  <div className="d-flex gap-2 mb-3">
                    <input
                      type="email"
                      className="form-control fd-email-input"
                      placeholder="e.g. notifications@company.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                    />
                    <button
                      type="button"
                      className="btn btn-primary px-3 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}
                      onClick={addEmail}
                    >
                      + Add
                    </button>
                  </div>

                  <div className="alert fd-email-info-hint py-2 px-3 mb-4 d-flex align-items-center gap-2">
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: "var(--brand-primary)",
                        flexShrink: 0,
                      }}
                    />
                    <span>Addresses listed here receive alerts on every new submission.</span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label fd-email-field-label">CC Recipient List</label>
                  <div className="d-flex flex-column gap-2 mb-3">
                    {ccEmailsList.length === 0 ? (
                      <div className="rounded-3 fd-email-recipient-card p-3 text-center text-muted" style={{ fontSize: 13 }}>
                        No CC recipients added
                      </div>
                    ) : (
                      ccEmailsList.map((e, i) => {
                        const initial = getEmailInitial(e);
                        return (
                          <div
                            key={`cc-${i}`}
                            className="rounded-3 fd-email-recipient-card p-2 d-flex align-items-center justify-content-between"
                          >
                            <div className="d-flex align-items-center gap-3">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{ width: 32, height: 32, background: "#64748b" }}
                              >
                                <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{initial}</span>
                              </div>
                              <span style={{ fontSize: 14, color: "var(--brand-dark)" }}>{e}</span>
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

                  <label className="form-label fd-email-field-label">Add New CC Recipient</label>
                  <div className="d-flex gap-2">
                    <input
                      type="email"
                      className="form-control fd-email-input"
                      placeholder="e.g. manager@company.com"
                      value={ccEmailInput}
                      onChange={(e) => setCcEmailInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCcEmail())}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary px-3 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}
                      onClick={addCcEmail}
                    >
                      + Add CC
                    </button>
                  </div>
                </div>

                <div className="mb-2">
                  <label className="form-label fd-email-field-label">Owner</label>
                  <div className="rounded-3 fd-email-recipient-card p-3 d-flex align-items-center gap-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: 36, height: 36, background: ownerColor }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{ownerInitial}</span>
                    </div>
                    <div className="d-flex flex-column">
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--brand-dark)" }}>
                        {ownerEmail || "—"}
                      </span>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>Owner</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {emailModalTab === "customTemplate" && showCustomTemplate && (
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
                  <label className="form-check-label" htmlFor="customTemplateEnabled">
                    Enable Custom Template for Notifications
                  </label>
                  <p className="text-muted small mb-0 mt-1" style={{ fontSize: 10 }}>
                    After editing, click <strong>Save template</strong> so submissions use this design (test email uses the editor; submissions use the saved HTML in MongoDB).
                  </p>
                </div>

                <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                  <label className="form-label mb-0 fd-email-field-label">
                    Drag &amp; Drop Email Builder
                  </label>
                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      style={{ fontSize: 12, fontWeight: 600 }}
                      disabled={!customTemplateDraft.enabled}
                      onClick={loadFormbridgeStarterLayout}
                    >
                      Load FormBridge layout
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      style={{ fontSize: 12, fontWeight: 600 }}
                      disabled={!customTemplateDraft.enabled || templateSaving}
                      onClick={() => previewCustomTemplate({ sendTest: false })}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 12, fontWeight: 600 }}
                      disabled={!customTemplateDraft.enabled || templateSaving}
                      onClick={saveCustomTemplate}
                    >
                      {templateSaving ? "Saving…" : "Save template"}
                    </button>
                  </div>
                </div>

                <div className="alert alert-light border py-2 px-3 mb-2" style={{ fontSize: 11 }}>
                  <strong>Form name &amp; URL</strong> use <code>{`{{FormName}}`}</code> and <code>{`{{DashboardUrl}}`}</code> (from this form automatically).
                  <br />
                  <strong>Submission data</strong> (JOB-TITLE, FULL-NAME, email, etc.) use <code>{`{{AllFields}}`}</code> — one block shows every field on each submit.
                  <br />
                  Click <strong>Load FormBridge layout</strong> for a ready-made design like your screenshot.
                </div>

                <div
                  className={`fd-custom-template-editor${!customTemplateDraft.enabled ? " fd-custom-template-editor--disabled" : ""}`}
                >
                  <EmailTemplateEditor
                    ref={emailEditorRef}
                    key={`custom-template-${formId}`}
                    initialDesign={customTemplateDraft.design}
                    disabled={!customTemplateDraft.enabled}
                    className="mb-2"
                  />
                </div>

                <div className="alert alert-info py-2 px-3 mb-0 fd-email-info-hint" style={{ fontSize: 11, lineHeight: "1.4" }}>
                  <div className="d-flex align-items-center gap-1 fw-bold mb-2 text-primary">
                    <LucideIcon name="info" style={{ width: 14, height: 14 }} />
                    <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      Available Placeholders
                    </span>
                  </div>
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    {["{{AllFields}}", "{{FormName}}", "{{DashboardUrl}}", "{{SubmittedAt}}", "{{IpAddress}}"].map(
                      (tag) => (
                        <code
                          key={tag}
                          className="bg-white border rounded px-1 text-primary"
                          style={{ cursor: "pointer", fontSize: 10 }}
                          onClick={() => copyToClipboard(tag)}
                        >
                          {tag}
                        </code>
                      )
                    )}
                  </div>
                  <div className="text-muted" style={{ fontSize: 10 }}>
                    Tip: Use <code>{`{{FieldName}}`}</code> to insert a specific field value.
                  </div>
                </div>
              </>
            )}

            {emailModalTab === "autoresponder" && showAutoresponder && (
              <>
                <div className="form-check form-switch mb-4">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="autoresponderEnabled"
                    checked={autoresponderDraft.enabled}
                    onChange={(e) =>
                      setAutoresponderDraft({ ...autoresponderDraft, enabled: e.target.checked })
                    }
                  />
                  <label className="form-check-label" htmlFor="autoresponderEnabled">
                    Enable Autoresponder (Thank You Message)
                  </label>
                </div>

                <div className="mb-3">
                  <label className="form-label fd-email-field-label" htmlFor="autoresponderSubject">
                    Email Subject
                  </label>
                  <input
                    id="autoresponderSubject"
                    type="text"
                    className="form-control fd-email-input"
                    value={autoresponderDraft.subject}
                    onChange={(e) =>
                      setAutoresponderDraft({ ...autoresponderDraft, subject: e.target.value })
                    }
                    disabled={!autoresponderDraft.enabled}
                    placeholder="Thank you for your submission!"
                  />
                </div>

                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label mb-0 fd-email-field-label">Message Body</label>
                  <button
                    type="button"
                    className="btn btn-link fd-email-clear-body p-0"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to clear the entire message body?")) {
                        setAutoresponderDraft({ ...autoresponderDraft, body: "" });
                      }
                    }}
                  >
                    Clear Body
                  </button>
                </div>

                <div className="fd-email-warning d-flex align-items-start gap-2 mb-2">
                  <LucideIcon
                    name="alert-triangle"
                    style={{ width: 12, height: 12, marginTop: 2, flexShrink: 0 }}
                  />
                  <span>
                    <strong>Warning:</strong> Adding large images directly can make the email very large,
                    causing it to be &quot;clipped&quot; (hidden) by Gmail. We recommend using smaller images or links.
                  </span>
                </div>

                <div
                  className={`mb-2 fd-quill-container${!autoresponderDraft.enabled ? " ql-disabled" : ""}`}
                >
                  <ReactQuill
                    theme="snow"
                    ref={autoresponderQuillRef}
                    value={autoresponderDraft.body}
                    onChange={(content) =>
                      setAutoresponderDraft({ ...autoresponderDraft, body: content })
                    }
                    modules={memoAutoresponderQuillModules}
                    formats={quillFormats}
                    placeholder="We have received your submission. Thank you!"
                    readOnly={!autoresponderDraft.enabled}
                  />
                </div>

                <details className="fd-email-settings-advanced">
                  <summary>Placeholders, attachments &amp; ID rules</summary>

                  <div className="alert alert-info py-2 px-3 mb-3 fd-email-info-hint" style={{ lineHeight: "1.4" }}>
                    <div className="d-flex align-items-center gap-1 fw-bold mb-2 text-primary">
                      <LucideIcon name="info" style={{ width: 14, height: 14 }} />
                      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        Available Placeholders
                      </span>
                    </div>
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {["{{AllFields}}", "{{FormName}}", "{{SubmittedAt}}"].map((tag) => (
                        <code
                          key={tag}
                          className="bg-white border rounded px-1 text-primary"
                          style={{ cursor: "pointer", fontSize: 10 }}
                          onClick={() => copyToClipboard(tag)}
                        >
                          {tag}
                        </code>
                      ))}
                    </div>
                    <div className="text-muted" style={{ fontSize: 10 }}>
                      Tip: Use <code>{`{{FieldName}}`}</code> to insert a specific field value.
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="form-label fd-email-field-label">
                      Default Email Attachment (PDF/Document)
                    </label>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
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
                                headers: {
                                  Authorization: `Bearer ${localStorage.getItem("authToken")}`,
                                },
                                body: formData,
                              });
                              if (res.ok) {
                                const { url } = await res.json();
                                setAutoresponderDraft((prev) => ({
                                  ...prev,
                                  attachmentUrl: url,
                                  attachmentName: file.name,
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
                        <div
                          className="d-flex align-items-center gap-2 bg-light rounded px-2 py-1 flex-grow-1"
                          style={{ fontSize: 11, minWidth: 0 }}
                        >
                          <LucideIcon
                            name="file-text"
                            className="text-secondary flex-shrink-0"
                            style={{ width: 12, height: 12 }}
                          />
                          <span className="text-truncate text-secondary">
                            {autoresponderDraft.attachmentName || "Attached file"}
                          </span>
                          <button
                            type="button"
                            className="btn btn-link p-0 text-danger ms-auto"
                            onClick={() =>
                              setAutoresponderDraft((prev) => ({
                                ...prev,
                                attachmentUrl: "",
                                attachmentName: "",
                              }))
                            }
                          >
                            <LucideIcon name="x" style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <label className="form-label mb-0 fd-email-field-label">ID based attachments</label>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          style={{ fontSize: 10 }}
                          disabled={!autoresponderDraft.enabled}
                          onClick={() =>
                            setAutoresponderDraft((prev) => ({
                              ...prev,
                              attachmentRules: [
                                ...(prev.attachmentRules || []),
                                {
                                  key: "",
                                  attachmentUrl: "",
                                  attachmentName: "",
                                  subject: "",
                                  body: "",
                                },
                              ],
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
                                  className="form-control form-control-sm fd-email-input"
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
                                  className="btn btn-sm btn-outline-danger flex-shrink-0"
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
                                <label className="form-label fd-email-field-label mb-1">
                                  Email Subject for this ID
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm fd-email-input"
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
                                <label className="form-label fd-email-field-label mb-1">
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
                                  modules={ruleQuillModules}
                                  formats={quillFormats}
                                  placeholder="Custom message body..."
                                  readOnly={!autoresponderDraft.enabled}
                                />
                              </div>

                              <div className="d-flex gap-2 align-items-center flex-wrap">
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
                                          headers: {
                                            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
                                          },
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
                      Max size 5MB. If payload has a matching ID, that specific file is sent; otherwise default
                      attachment is used.
                    </p>
                  </div>
                </details>
              </>
            )}
          </div>

          <div className="modal-footer border-0 justify-content-end">
            <button type="button" className="btn fd-email-btn-cancel" onClick={goBackToForm}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary fd-email-btn-save"
              onClick={saveEmailSettings}
              disabled={emailSettingsSaving}
            >
              {emailSettingsSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      <EmailTemplatePreviewModal
        html={previewHtml}
        onClose={() => setPreviewHtml(null)}
        onSendTest={() => previewCustomTemplate({ sendTest: true })}
        sendingTest={templatePreviewSending}
      />
    </div>
  );
}
