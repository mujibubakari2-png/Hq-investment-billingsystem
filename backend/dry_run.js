const fs = require('fs');
const path = require('path');

let noUserPayloadCount = 0;
let validCount = 0;

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

walkDir(path.join(__dirname, 'src/app/api'), filePath => {
    if (!filePath.endsWith('.ts')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('import prisma from "@/lib/prisma"')) return;

    if (!content.includes('getUserFromRequest')) {
        console.log('NO USER PAYLOAD:', filePath);
        noUserPayloadCount++;
    } else {
        validCount++;
    }
});
console.log(`\nValid (has getUserFromRequest): ${validCount}`);
console.log(`No user payload: ${noUserPayloadCount}`);
