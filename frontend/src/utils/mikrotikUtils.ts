/**
 * Sanitizes a name for MikroTik usage (Profiles, Users, etc.)
 * Removes leading/trailing punctuation and replaces internal spaces with hyphens.
 * This should match the logic in the backend.
 */
export function sanitizeMikroTikName(name: string): string {
    if (!name) return "unnamed";
    return name.trim()
        .replace(/^[^\w\d]+|[^\w\d]+$/g, "") // Remove leading/trailing non-alphanumeric chars
        .replace(/\s+/g, "-")                // Replace internal spaces with hyphens
        .replace(/-+/g, "-")                 // Collapse multiple hyphens
        .toLowerCase();
}
