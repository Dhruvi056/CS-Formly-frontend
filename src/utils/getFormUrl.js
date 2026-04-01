export function getFormUrl(formId) {
  const vercelUrl = process.env.REACT_APP_VERCEL_URL;

  if (vercelUrl) {
    const cleanUrl = vercelUrl.replace(/^https?:\/\//, "");
    return `https://${cleanUrl}/api/forms/${formId}`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/forms/${formId}`;
  }

  const baseUrl = process.env.REACT_APP_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/api/forms/${formId}`;
}
