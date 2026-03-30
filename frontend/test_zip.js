import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testZipGeneration() {
    const zip = new JSZip();
    
    // Mock data
    const companyName = "HQ INVESTMENT";
    const selectedRouter = { name: "Test Router", host: "192.168.88.1" };
    
    // 1. api.json
    zip.file("api.json", `{
   "captive": $(if logged-in == 'yes')false$(else)true$(endif),
   "user-portal-url": "$(link-login-only)",
$(if session-timeout-secs != 0)
   "seconds-remaining": $(session-timeout-secs),
$(endif)
$(if remain-bytes-total)
   "bytes-remaining": $(remain-bytes-total),
$(endif)
   "can-extend-session": true
}`);

    // 2. errors.txt
    zip.file("errors.txt", `# ERRORS
internal-error = internal error ($(error-orig))
# ... (truncated for test)
radius-reply = $(error-orig)`);

    // 3. XSD
    zip.file("WISPAaccessGatewaParam.xsd", `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema ...> ... </xs:schema>`);

    // 4. README.txt
    zip.file("README.txt", `HQINVESTMENT HOTSPOT LOGIN PAGE
========================
Generated on: ${new Date().toLocaleString()}
Company: ${companyName}
Router: ${selectedRouter.name} (${selectedRouter.host})

FILES INCLUDED:
- login.html
- alogin.html
- redirect.html
- api.json
- errors.txt
- WISPAaccessGatewaParam.xsd`);

    const content = await zip.generateAsync({ type: "nodebuffer" });
    const outputPath = path.join(__dirname, 'test_hotspot.zip');
    fs.writeFileSync(outputPath, content);
    console.log(`ZIP generated at: ${outputPath}`);
    
    console.log("Contents of ZIP:");
    const files = zip.files;
    Object.keys(files).forEach(filename => {
        console.log(` - ${filename}`);
    });
}

testZipGeneration().catch(console.error);
