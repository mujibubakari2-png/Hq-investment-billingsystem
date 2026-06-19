import { signRefreshToken, verifyRefreshToken } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import * as cache from '@/lib/cache';

beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'A'.repeat(48);
    process.env.JWT_REFRESH_SECRET = 'B'.repeat(48);
});

describe('Refresh token rotation & revocation', () => {
    it('signRefreshToken includes jti and tokenType', () => {
        const token = signRefreshToken({ userId: 'u1', username: 'u1', role: 'ADMIN' });
        const decoded: any = jwt.decode(token);
        expect(decoded).toBeTruthy();
        expect(decoded.tokenType).toBe('refresh');
        expect(decoded.jti).toBeTruthy();
    });

    it('verifyRefreshToken rejects revoked jti', async () => {
        // Create a token with known jti
        const token = signRefreshToken({ userId: 'u2', username: 'u2', role: 'ADMIN' });
        const decoded: any = jwt.decode(token);
        // Mock cacheGet to return true for revoked key
        jest.spyOn(cache as any, 'cacheGet').mockImplementation(async (...args: any[]) => {
            const key = args[0] as string;
            if (key === `revoked_refresh:${decoded.jti}`) return true;
            return null;
        });

        const ok = await verifyRefreshToken(token);
        expect(ok).toBeNull();
    });
});
