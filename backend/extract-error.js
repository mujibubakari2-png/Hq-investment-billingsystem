const { exec } = require('child_process');
exec('npx jest --config jest.config.ts src/__tests__/tenantIsolation.test.ts', (err, stdout, stderr) => {
    const output = stdout + '\n' + stderr;
    const match = output.match(/PrismaClientValidationError:[\s\S]*?Argument.*?missing/);
    if (match) {
        console.log("MATCHED ERROR:");
        console.log(match[0]);
    } else {
        const otherMatch = output.match(/PrismaClientValidationError:[\s\S]*?(?=\n\n)/);
        if (otherMatch) {
            console.log("OTHER PRISMA ERROR:");
            console.log(otherMatch[0]);
        } else {
            console.log("NO PRISMA ERROR FOUND. FULL OUTPUT DUMP:");
            console.log(output.substring(0, 1000));
        }
    }
});
