/**
 * codemod-lib-console-to-logger.js
 *
 * Replaces console.error / console.warn / console.log calls in src/lib/ files
 * with logger.error / logger.warn / logger.info equivalents,
 * adding the logger import where missing.
 */

const fs   = require("fs");
const path = require("path");

const LIB_DIR       = path.join(__dirname, "..");   // src/lib/
const LOGGER_IMPORT = `import logger from "@/lib/logger";\n`;

// Skip the logger itself to avoid circular imports
const SKIP_FILES = new Set(["logger.ts", "logger.js"]);

function findTsFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files   = [];
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory())                            files.push(...findTsFiles(full));
        else if (e.name.endsWith(".ts") && !SKIP_FILES.has(e.name)) files.push(full);
    }
    return files;
}

function transformFile(filePath) {
    let src = fs.readFileSync(filePath, "utf8");
    const original = src;

    // Add logger import if not present and file uses console.*
    const needsImport = /console\.(error|warn|log)/.test(src)
        && !src.includes('from "@/lib/logger"')
        && !src.includes("from '@/lib/logger'");

    if (needsImport) {
        const lastImportIdx = src.lastIndexOf("\nimport ");
        if (lastImportIdx === -1) {
            src = LOGGER_IMPORT + src;
        } else {
            const eol = src.indexOf("\n", lastImportIdx + 1);
            src = src.slice(0, eol + 1) + LOGGER_IMPORT + src.slice(eol + 1);
        }
    }

    // console.error(X)  →  logger.error(X)
    src = src.replace(/\bconsole\.error\(/g, "logger.error(");
    // console.warn(X)   →  logger.warn(X)
    src = src.replace(/\bconsole\.warn\(/g,  "logger.warn(");
    // console.log(X)    →  logger.info(X)
    src = src.replace(/\bconsole\.log\(/g,   "logger.info(");

    if (src === original) return false;
    fs.writeFileSync(filePath, src, "utf8");
    return true;
}

const files   = findTsFiles(LIB_DIR);
let   changed = 0;
for (const f of files) {
    if (transformFile(f)) {
        console.log(`  ✓ ${path.relative(LIB_DIR, f)}`);
        changed++;
    }
}
console.log(`\nDone. Transformed ${changed} lib files.`);
