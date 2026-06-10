type TenantSlugLookup = {
    tenant: {
        findUnique(args: { where: { slug: string }; select: { id: true } }): Promise<{ id: string } | null>;
    };
};

export function slugifyTenantName(input: string): string {
    const slug = input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-");

    return slug || "tenant";
}

export async function createUniqueTenantSlug(db: TenantSlugLookup, name: string): Promise<string> {
    const base = slugifyTenantName(name);
    let slug = base;
    let suffix = 1;

    while (await db.tenant.findUnique({ where: { slug }, select: { id: true } })) {
        suffix += 1;
        slug = `${base}-${suffix}`;
    }

    return slug;
}
