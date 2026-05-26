import { createPortal } from "react-dom";

export default function EmailTemplatePreviewModal({
  html,
  onClose,
  onSendTest,
  sendingTest,
}) {
  if (!html) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[13000] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-preview-title"
    >
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-3xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 id="email-preview-title" className="text-base font-semibold text-gray-900 m-0">
            Email Preview
          </h2>
          <button type="button" className="btn btn-sm btn-light" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-gray-50 min-h-[200px]">
          <iframe
            title="Email template preview"
            srcDoc={html}
            className="w-full border-0 bg-white rounded-lg shadow-sm"
            style={{ minHeight: 480 }}
            sandbox="allow-same-origin"
          />
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-100">
          <button type="button" className="btn btn-light btn-sm" onClick={onClose}>
            Close
          </button>
          {onSendTest && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onSendTest}
              disabled={sendingTest}
            >
              {sendingTest ? "Sending…" : "Send test to my email"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
