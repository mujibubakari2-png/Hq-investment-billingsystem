const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'frontend', 'src');

function walkSync(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      filelist = walkSync(filepath, filelist);
    } else {
      if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
        filelist.push(filepath);
      }
    }
  }
  return filelist;
}

const files = walkSync(srcDir);

let changedFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace common 2-column inline grid with className="grid-2"
  content = content.replace(/style=\{\{\s*display:\s*['"]grid['"]\s*,\s*gridTemplateColumns:\s*['"]1fr 1fr['"]\s*,\s*gap:\s*(\d+)(,\s*marginBottom:\s*(.*?))?\s*\}\}/g, 
    (match, gap, hasMargin, marginVal) => {
        return `className="grid-2 gap-${gap}"${hasMargin ? ` style={{ marginBottom: ${marginVal} }}` : ''}`;
  });

  // Replace common 3-column inline grid with className="grid-3"
  content = content.replace(/style=\{\{\s*display:\s*['"]grid['"]\s*,\s*gridTemplateColumns:\s*['"]repeat\(3,\s*1fr\)['"]\s*,\s*gap:\s*(\d+)(,\s*marginBottom:\s*(.*?))?\s*\}\}/g, 
    (match, gap, hasMargin, marginVal) => {
        return `className="grid-3 gap-${gap}"${hasMargin ? ` style={{ marginBottom: ${marginVal} }}` : ''}`;
  });

  // Replace common 4-column inline grid with className="grid-4"
  content = content.replace(/style=\{\{\s*display:\s*['"]grid['"]\s*,\s*gridTemplateColumns:\s*['"]repeat\(4,\s*1fr\)['"]\s*,\s*gap:\s*(\d+)(,\s*marginBottom:\s*(.*?))?\s*\}\}/g, 
    (match, gap, hasMargin, marginVal) => {
        return `className="grid-4 gap-${gap}"${hasMargin ? ` style={{ marginBottom: ${marginVal} }}` : ''}`;
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    changedFiles++;
    console.log(`Updated: ${file}`);
  }
}

console.log(`Total files updated: ${changedFiles}`);
