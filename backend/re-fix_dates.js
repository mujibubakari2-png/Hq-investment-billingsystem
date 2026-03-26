const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.ts')) results.push(file);
        }
    });
    return results;
}

const files = walk('C:/Users/hqbak/kenge/backend/src/app/api');
files.forEach(file => {
   let content = fs.readFileSync(file, 'utf8');
   let changed = false;

   // Replace toLocaleString
   if (content.includes('toLocaleString("en-US", {')) {
       content = content.replace(/toLocaleString\("en-US",\s*{/g, 'toLocaleString("en-US", { timeZone: "Africa/Dar_es_Salaam",');
       changed = true;
   }

   // Replace toLocaleDateString
   if (content.includes('toLocaleDateString("en-US", {')) {
       content = content.replace(/toLocaleDateString\("en-US",\s*{/g, 'toLocaleDateString("en-US", { timeZone: "Africa/Dar_es_Salaam",');
       changed = true;
   }

   if (changed) {
       fs.writeFileSync(file, content);
       console.log('Fixed timezones in:', file);
   }
});
