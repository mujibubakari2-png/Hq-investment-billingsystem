const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

function processFile(filePath) {
    if (!filePath.endsWith('.ts')) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // Skip if no prisma import
    if (!content.includes('import prisma from "@/lib/prisma"')) return;
    
    // Skip if no user payload
    if (!content.includes('getUserFromRequest')) return;

    // We already refactored if getTenantClient is there
    if (content.includes('getTenantClient')) return;

    // 1. Add the import for getTenantClient
    content = content.replace(
        'import prisma from "@/lib/prisma";',
        'import { getTenantClient } from "@/lib/tenantPrisma";\nimport prisma from "@/lib/prisma";'
    );

    // 2. Inject db initialization after getUserFromRequest block
    // The typical block is:
    // const userPayload = getUserFromRequest(req);
    // if (!userPayload) return errorResponse("Unauthorized", 401);
    
    const rx = /(const userPayload\s*=\s*getUserFromRequest\(req\);[\s\S]*?if\s*\(!userPayload\).*?;)/;
    
    content = content.replace(rx, match => {
        return match + '\n        const db = getTenantClient(userPayload.role === "SUPER_ADMIN" ? null : userPayload.tenantId);';
    });

    // 3. Replace `prisma.` with `db.` globally, EXCEPT for `$transaction`, `$queryRaw`, `$executeRaw`, and `$connect`, `$disconnect`
    // We will specifically target typical Prisma models
    const safeReplaceRegex = /prisma\.(?!(\$transaction|\$queryRaw|\$executeRaw|\$connect|\$disconnect))/g;
    
    // But wait, what if `prisma.` is used BEFORE `const db = ...` in the same file?
    // In our codebase, DB calls only happen inside the route handlers (GET/POST/PUT/DELETE).
    // Let's do the replace.
    
    // But first, `const [items, count] = await Promise.all([ prisma.model.findMany... ])` 
    // `prisma.` becomes `db.`.
    
    content = content.replace(safeReplaceRegex, 'db.');
    
    // 4. Remove `...tenantFilter` from where clauses since `db` already handles it!
    // Often it is `const where: any = { ...tenantFilter };`
    // We can just leave `...tenantFilter` defined as it is mostly harmless (it will just add {tenantId: val} to where, which is redundant but safe).
    // BUT we need to make sure we don't break anything.
    // If the file uses `tenantFilter` it is fine.
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Refactored ${filePath}`);
}

walkDir(path.join(__dirname, 'src/app/api'), processFile);
