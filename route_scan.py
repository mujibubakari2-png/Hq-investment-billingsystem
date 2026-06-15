import pathlib
import sys

base = pathlib.Path('backend/src/app/api')
routes = sorted(base.rglob('route.ts'))
print('ROUTE_COUNT', len(routes))
for p in routes:
    text = p.read_text(encoding='utf-8')
    if 'import prisma from "@/lib/prisma"' in text and 'getTenantClient(' not in text:
        auth = any(x in text for x in ['getUserFromRequest(', 'requireAuth(', 'requirePermission(', 'requireRole('])
        flag = 'AUTH' if auth else 'NOAUTH'
        print(f'{p}|{flag}')
