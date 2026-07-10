const fs = require('fs');
const path = require('path');

function getTestFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getTestFiles(fullPath, fileList);
    } else if (fullPath.endsWith('.test.ts')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const testsDir = path.join(__dirname, 'src', '__tests__');
const testFiles = getTestFiles(testsDir);
let changedCount = 0;

for (const file of testFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace bad import
  content = content.replace(/import \{ Prisma \} from '@prisma\/client';/g, "import { Prisma } from '@/generated/prisma';");
  
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Fixed import in:', file);
    changedCount++;
  }
}
console.log('Total files fixed imports:', changedCount);
