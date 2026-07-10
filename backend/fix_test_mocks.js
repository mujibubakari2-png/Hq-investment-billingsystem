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

  // Replace mock values in common fields: amount, price, total, unitPrice
  // Only replace if they are plain numbers.
  // We'll replace them with { toNumber: () => [NUMBER] } which perfectly mocks Decimal for our use case.
  // We use regex to match amount: 1000, price: 50, etc.

  content = content.replace(/(amount|price|total|unitPrice):\s*(\d+(?:\.\d+)?)(?=[,}\s])/g, '$1: new Prisma.Decimal($2)');
  
  // If we injected Prisma.Decimal, we need to ensure Prisma is imported!
  if (content !== original) {
    if (!content.includes("import { Prisma }")) {
      content = "import { Prisma } from '@prisma/client';\n" + content;
    }
    fs.writeFileSync(file, content);
    console.log('Fixed:', file);
    changedCount++;
  }
}
console.log('Total files fixed:', changedCount);
