/**
 * Sanitizes a name for MikroTik usage (Profiles, Users, Filenames, etc.)
 * Removes leading/trailing punctuation, replaces spaces with hyphens,
 * removes all other special characters, collapses multiple dashes,
 * and trims any leading/trailing dashes from the result.
 * This matches the logic used in backend/src/lib/mikrotik.ts.
 */
export function sanitizeMikroTikName(name: string): string {
    if (!name) return "unnamed";
    return name
        .trim()
        .replace(/\s+/g, "-")                  // spaces → dash
        .replace(/[^a-zA-Z0-9\-]/g, "")        // remove ALL special chars except hyphens
        .replace(/-+/g, "-")                   // collapse multiple dashes
        .replace(/^-+|-+$/g, "")               // trim leading/trailing dashes
        .toLowerCase()
        || "unnamed";                          // fallback if result is empty
}
