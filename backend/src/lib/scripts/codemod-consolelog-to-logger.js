/**
 * codemod-consolelog-to-logger.js
 *
 * Replaces remaining console.log("...") calls in API route files with
 * logger.info("...") calls, adding the logger import if not already present.
 *
 * Targets only the files still using console.log after the previous codemod.
 */

const fs   = require("fs");
const path = require("path");

const API_DIR = path.join(__dirname, "../../app/api");
const LOGGER_IMPORT = `import logger from "@/lib/logger";\n`;

function findTsFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files   = [];
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory())             files.push(...findTsFiles(full));
        else if (e.name.endsWith(".ts")) files.push(full);
    }
    return files;
}

function transformFile(filePath) {
    let src = fs.readFileSync(filePath, "utf8");
    if (!/console\.log/.test(src)) return false;

    // Add logger import if missing
    if (!src.includes('from "@/lib/logger"') && !src.includes("from '@/lib/logger'")) {
        const lastImportIdx = src.lastIndexOf("\nimport ");
        if (lastImportIdx === -1) {
            src = LOGGER_IMPORT + src;
        } else {
            const eol = src.indexOf("\n", lastImportIdx + 1);
            src = src.slice(0, eol + 1) + LOGGER_IMPORT + src.slice(eol + 1);
        }
    }

    // console.log("LABEL", varOrErr)  →  logger.info("LABEL", { detail: varOrErr })
    src = src.replace(
        /console\.log\((`[^`]*`|"[^"]*"|'[^']*'),\s*(\w+(?:\??\.\w+)*)\)/g,
        (_, label, varName) => `logger.info(${label}, { detail: String(${varName}) })`
    );

    // console.log("LABEL only")  →  logger.info("LABEL only")
    src = src.replace(
        /console\.log\((`[^`]*`|"[^"]*"|'[^']*')\)/g,
        (_, label) => `logger.info(${label})`
    );

    // console.log(bareVar)  →  logger.info("[route] info", { detail: String(bareVar) })
    src = src.replace(
        /console\.log\((\w+(?:\??\.\w+)*)\)/g,
        (_, varName) => `logger.info("[route] info", { detail: String(${varName}) })`
    );

    fs.writeFileSync(filePath, src, "utf8");
    return true;
}

const files   = findTsFiles(API_DIR);
let   changed = 0;
for (const f of files) {
    if (transformFile(f)) {
        console.log(`  ✓ ${path.relative(API_DIR, f)}`);
        changed++;
    }
}
console.log(`\nDone. Transformed ${changed} files.`);
