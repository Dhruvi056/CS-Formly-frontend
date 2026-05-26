import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import EmailEditor from "react-email-editor";
import "../../styles/components/email-template-editor.css";

/**
 * Unlayer drag-and-drop email builder.
 * Blocks: Text, Heading, Image, Button, Divider, Columns, Social, etc.
 */
const EmailTemplateEditor = forwardRef(function EmailTemplateEditor(
  { initialDesign, disabled = false, onReady, className = "" },
  ref
) {
  const editorRef = useRef(null);
  const designLoadedRef = useRef(false);

  const getEditor = useCallback(() => editorRef.current?.editor, []);

  useImperativeHandle(ref, () => ({
    exportHtml() {
      return new Promise((resolve, reject) => {
        const editor = getEditor();
        if (!editor) {
          reject(new Error("Email editor is not ready"));
          return;
        }
        editor.exportHtml((data) => {
          resolve({
            html: data?.html || "",
            design: data?.design || null,
          });
        });
      });
    },
    saveDesign() {
      return new Promise((resolve, reject) => {
        const editor = getEditor();
        if (!editor) {
          reject(new Error("Email editor is not ready"));
          return;
        }
        editor.saveDesign((design) => resolve(design || null));
      });
    },
    loadDesign(design) {
      const editor = getEditor();
      if (!editor || !design) return;
      editor.loadDesign(design);
      designLoadedRef.current = true;
    },
  }));

  const handleEditorReady = useCallback(() => {
    const editor = getEditor();
    if (editor && initialDesign && !designLoadedRef.current) {
      editor.loadDesign(initialDesign);
      designLoadedRef.current = true;
    } else if (editor && !initialDesign && !designLoadedRef.current) {
      designLoadedRef.current = true;
    }
    onReady?.();
  }, [getEditor, initialDesign, onReady]);

  useEffect(() => {
    designLoadedRef.current = false;
  }, [initialDesign]);

  useEffect(() => {
    const editor = getEditor();
    if (!editor || !initialDesign || designLoadedRef.current) return;
    editor.loadDesign(initialDesign);
    designLoadedRef.current = true;
  }, [initialDesign, getEditor]);

  const projectId = process.env.REACT_APP_UNLAYER_PROJECT_ID || undefined;

  const editorOptions = {
    displayMode: "email",
    locale: "en-US",
    appearance: {
      theme: "light",
      panels: { tools: { dock: "left" } },
    },
    tools: {
      form: { enabled: false },
      menu: { enabled: false },
      html: { enabled: true },
    },
    features: {
      preview: false,
      stockImages: true,
    },
  };

  return (
    <div
      className={`relative rounded-lg border border-gray-200 overflow-hidden bg-white ${className} ${
        disabled ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      <div className="min-h-[420px] w-full email-editor-wrapper">
        <EmailEditor
          ref={editorRef}
          onReady={handleEditorReady}
          minHeight={420}
          options={editorOptions}
          projectId={projectId}
          style={{ minHeight: 420 }}
        />
      </div>
      {disabled && (
        <div
          className="absolute inset-0 z-10 bg-white/40 cursor-not-allowed"
          title="Enable custom template to edit"
        />
      )}
    </div>
  );
});

export default EmailTemplateEditor;
