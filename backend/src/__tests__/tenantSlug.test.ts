/**
 * tenantSlug utility unit tests
 * Tests: slugifyTenantName (pure), createUniqueTenantSlug (async with DB mock)
 */

import { slugifyTenantName, createUniqueTenantSlug } from '../lib/tenantSlug';

// â”€â”€ slugifyTenantName â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('slugifyTenantName', () => {
    it('lowercases the name', () => {
        expect(slugifyTenantName('MyISP')).toBe('myisp');
    });

    it('replaces spaces with hyphens', () => {
        expect(slugifyTenantName('HQ Investment')).toBe('hq-investment');
    });

    it('replaces special characters with hyphens', () => {
        expect(slugifyTenantName('Acme@Corp!')).toBe('acme-corp');
    });

    it('collapses multiple separators into one hyphen', () => {
        expect(slugifyTenantName('my  --  isp')).toBe('my-isp');
    });

    it('trims leading and trailing hyphens', () => {
        expect(slugifyTenantName('--isp--')).toBe('isp');
    });

    it('trims whitespace before processing', () => {
        expect(slugifyTenantName('  My ISP  ')).toBe('my-isp');
    });

    it('returns "tenant" for empty string', () => {
        expect(slugifyTenantName('')).toBe('tenant');
    });

    it('returns "tenant" when only special chars given', () => {
        expect(slugifyTenantName('!!!')).toBe('tenant');
    });

    it('handles numbers in name', () => {
        expect(slugifyTenantName('ISP 2024')).toBe('isp-2024');
    });

    it.each([
        ['HQ Investment Ltd',   'hq-investment-ltd'],
        ['Karibu-Net (Tz)',     'karibu-net-tz'],
        ['Juhudi Fibre 360Â°',   'juhudi-fibre-360'],
        ['   ',                 'tenant'],
    ])('slugifies "%s" â†’ "%s"', (input, expected) => {
        expect(slugifyTenantName(input)).toBe(expected);
    });
});

// â”€â”€ createUniqueTenantSlug â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('createUniqueTenantSlug', () => {
    function makeDb(existingSlugs: string[]) {
        return {
            tenant: {
                findUnique: jest.fn().mockImplementation(
                    ({ where: { slug } }: { where: { slug: string } }) =>
                        Promise.resolve(existingSlugs.includes(slug) ? { id: 'x' } : null)
                ),
            },
        };
    }

    it('returns base slug when no conflict', async () => {
        const db = makeDb([]);
        const slug = await createUniqueTenantSlug(db, 'HQ Investment');
        expect(slug).toBe('hq-investment');
    });

    it('appends -2 when base slug already exists', async () => {
        const db = makeDb(['hq-investment']);
        const slug = await createUniqueTenantSlug(db, 'HQ Investment');
        expect(slug).toBe('hq-investment-2');
    });

    it('increments suffix until a free slug is found', async () => {
        const db = makeDb(['hq-investment', 'hq-investment-2', 'hq-investment-3']);
        const slug = await createUniqueTenantSlug(db, 'HQ Investment');
        expect(slug).toBe('hq-investment-4');
    });

    it('queries the DB for each candidate slug', async () => {
        const db = makeDb(['isp', 'isp-2']);
        await createUniqueTenantSlug(db, 'ISP');
        // Should have checked 'isp', 'isp-2', 'isp-3'
        expect(db.tenant.findUnique).toHaveBeenCalledTimes(3);
    });

    it('handles empty-string name gracefully (falls back to "tenant")', async () => {
        const db = makeDb([]);
        const slug = await createUniqueTenantSlug(db, '');
        expect(slug).toBe('tenant');
    });
});
