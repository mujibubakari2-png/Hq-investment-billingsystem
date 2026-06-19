const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

function parseDbUrl(rawUrl) {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isTcpReachable(host, port, timeout = 4000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function replaceDatabaseName(rawUrl, dbName) {
  const parsed = parseDbUrl(rawUrl);
  if (!parsed) throw new Error(`Invalid DATABASE_URL: ${rawUrl}`);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

async function resolveDatabaseUrl() {
  const explicitUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  let baseDbUrl = explicitUrl || '';
  let source = explicitUrl ? (process.env.TEST_DATABASE_URL ? 'TEST_DATABASE_URL' : 'DATABASE_URL') : '.env';

  if (!baseDbUrl) {
    try {
      const envPath = path.join(__dirname, '..', '.env');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/DATABASE_URL=["']?([^"'\n]+)/);
      if (match) {
        baseDbUrl = match[1];
        source = '.env';
      }
    } catch (err) {
      console.log('No .env file found or could not read DATABASE_URL. Using default localhost fallback.');
    }
  }

  if (!baseDbUrl) {
    // No credential fallback — require TEST_DATABASE_URL or DATABASE_URL to be set.
    // If neither is available, we fall back to a local postgres with a placeholder
    // credential that will fail loudly rather than silently using a real password.
    baseDbUrl = 'postgresql://test_user:test_password_placeholder@127.0.0.1:5432/hqinvestment_isp';
    source = 'fallback (placeholder — set TEST_DATABASE_URL or DATABASE_URL)';
  }

  const testDbUrl = replaceDatabaseName(baseDbUrl, 'testdb');

  const parsed = parseDbUrl(testDbUrl);
  if (parsed && parsed.hostname && parsed.port) {
    const reachable = await isTcpReachable(parsed.hostname, Number(parsed.port));
    if (!reachable) {
      // Cannot reach the configured DB host — bail out rather than falling back
      // to a hardcoded credential. Callers must provide a reachable TEST_DATABASE_URL.
      console.warn(`Database host ${parsed.hostname}:${parsed.port} is unreachable. Set TEST_DATABASE_URL to a reachable test database.`);
      process.exit(1);
    }
  }

  return { url: testDbUrl, source };
}

function runDbPush(dbUrl) {
  return execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: dbUrl } });
}

(async () => {
  try {
    const { url: testDbUrl, source } = await resolveDatabaseUrl();
    process.env.DATABASE_URL = testDbUrl;
    console.log(`Using DATABASE_URL from ${source}: ${testDbUrl}`);
    console.log('Setting up test database at ' + process.env.DATABASE_URL + ' ...');
    runDbPush(testDbUrl);
    console.log('Test database setup complete.');
  } catch (error) {
    console.warn('Primary test database setup failed:', error.message);
    // No fallback to hardcoded credentials — require environment variables.
    console.error('Set TEST_DATABASE_URL or DATABASE_URL to a reachable test database.');
    console.error('Failed to set up test database:', error.message);
    process.exit(1);
  }
})();
