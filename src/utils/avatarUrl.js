/**
 * Returns a safe avatar URL for <img src>, or "" to use a placeholder icon.
 */
export function resolveAvatarUrl(url) {
  if (!url || typeof url !== "string") return "";

  const trimmed = url.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  if (lower === "profile" || lower === "/profile" || lower.endsWith("/profile")) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    if (
      /^\/(api|uploads|assets|static)\//i.test(trimmed) ||
      /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(trimmed)
    ) {
      return trimmed;
    }
    return "";
  }

  return "";
}

export function isExternalAvatarUrl(url) {
  return /^https?:\/\//i.test(url || "");
}
