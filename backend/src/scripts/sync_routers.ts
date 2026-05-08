import prisma from "../lib/prisma";
import { MikroTikService } from "../lib/mikrotik";

async function syncAllRouters() {
  console.log("🚀 Starting global router sync...");
  
  const routers = await prisma.router.findMany({
    where: { status: "ONLINE" } // Or all routers
  });

  console.log(`Found ${routers.length} routers to sync.`);

  for (const router of routers) {
    try {
      console.log(`\nSyncing router: ${router.name} (${router.host})`);
      
      const conn = {
        host: router.host,
        port: router.port || 8728,
        username: router.username || "admin",
        password: router.password || ""
      };

      const mikrotik = new MikroTikService(conn, router.id, router.tenantId);
      
      // 1. Test connection and update status/resources
      const testResult = await mikrotik.testConnection();
      console.log(`- Connection test: ${testResult.success ? "✅" : "❌"} ${testResult.message}`);

      if (testResult.success) {
        // 2. Sync active sessions
        const sessions = await mikrotik.listAllActiveSessions();
        console.log(`- Active sessions: ${sessions.length}`);
      }

    } catch (error) {
      console.error(`❌ Failed to sync router ${router.name}:`, error.message);
    }
  }

  console.log("\n✅ Global sync complete!");
}

syncAllRouters()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
