/**
 * codemod-console-to-logger.ps1 equivalent — run as Node.js script
 *
 * For every API route file that uses console.error/warn:
 *   1. Add `import logger from "@/lib/logger";` if not already present
 *   2. Replace console.error("...", e) → logger.error("...", { error: ... })
 *   3. Replace console.warn("...", e)  → logger.warn("...", { error: ... })
 *   4. Replace bare console.error(e)   → logger.error("...", { error: e })
 */

const fs   = require("fs");
const path = require("path");

const API_DIR = path.join(__dirname, "../../app/api");

// Recursively find all .ts files
function findTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files   = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory())           files.push(...findTsFiles(full));
    else if (e.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

const LOGGER_IMPORT = `import logger from "@/lib/logger";\n`;

function transformFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");

  // Skip if no console.error or console.warn at all
  if (!/console\.(error|warn)/.test(src)) return false;

  // 1. Add logger import if missing
  if (!src.includes('from "@/lib/logger"') && !src.includes("from '@/lib/logger'")) {
    // Insert after the last import block
    const lastImportIdx = src.lastIndexOf("\nimport ");
    if (lastImportIdx === -1) {
      src = LOGGER_IMPORT + src;
    } else {
      // Find end of that import line
      const eol = src.indexOf("\n", lastImportIdx + 1);
      src = src.slice(0, eol + 1) + LOGGER_IMPORT + src.slice(eol + 1);
    }
  }

  // 2. Replace patterns — most specific first
  // console.error("LABEL", varOrErr)  →  logger.error("LABEL", { error: varOrErr })
  src = src.replace(
    /console\.(error|warn)\((`[^`]*`|"[^"]*"|'[^']*'),\s*(\w+(?:\??\.\w+)*)\)/g,
    (_, level, label, errVar) =>
      `logger.${level}(${label}, { error: ${errVar} instanceof Error ? ${errVar}.message : String(${errVar}) })`
  );

  // console.error("LABEL only") → logger.error("LABEL only")
  src = src.replace(
    /console\.(error|warn)\((`[^`]*`|"[^"]*"|'[^']*')\)/g,
    (_, level, label) => `logger.${level}(${label})`
  );

  // console.error(bareVar) → logger.error("[route] error", { error: bareVar })
  src = src.replace(
    /console\.(error|warn)\((\w+(?:\??\.\w+)*)\)/g,
    (_, level, errVar) =>
      `logger.${level}("[route] error", { error: ${errVar} instanceof Error ? ${errVar}.message : String(${errVar}) })`
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
