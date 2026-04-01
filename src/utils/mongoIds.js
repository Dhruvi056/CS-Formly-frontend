/**
 * Normalize Mongo _id / populated ref fields to a string for comparisons and keys.
 */
export function normalizeMongoId(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object" && value._id != null) return String(value._id);
  return String(value);
}
