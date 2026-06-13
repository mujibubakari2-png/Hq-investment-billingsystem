const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read base DATABASE_URL from .env
let baseDbUrl = '';
try {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?([^"'\n]+)/);
  if (match) {
    baseDbUrl = match[1];
  }
} catch (err) {
  console.log('No .env file found or could not read DATABASE_URL. Using default localhost.');
  baseDbUrl = 'postgresql://enterprisedb:Muu%4066487125@127.0.0.1:5432/hqinvestment_isp';
}

// Replace the database name with 'testdb'
const urlObj = new URL(baseDbUrl);
urlObj.pathname = '/testdb';
const testDbUrl = urlObj.toString();

process.env.DATABASE_URL = testDbUrl;

console.log('Setting up test database at ' + process.env.DATABASE_URL + ' ...');
try {
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: testDbUrl } });
  console.log('Test database setup complete.');
} catch (error) {
  console.error('Failed to set up test database:', error.message);
  process.exit(1);
}
