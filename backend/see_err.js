const fs = require('fs');

try {
    const raw = fs.readFileSync('error.html', 'utf16le');
    // The NextJS error often contains an error message string or stack trace.
    // Look for standard webpack or compiler messages.
    const match = raw.match(/([^\n]*\^\n[^\n]*)/s);
    if (match) {
        console.log("Found error snippet:");
        console.log(match[0]);
    } else {
        const text = raw.replace(/<[^>]+>/g, ' '); // Strip basic HTML tags
        console.log(text.substring(0, 1000));
    }
} catch(e) {
    console.log("Error reading file", e.message);
}
