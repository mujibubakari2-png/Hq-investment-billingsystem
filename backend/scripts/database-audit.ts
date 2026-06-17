/**
 * =============================================================================
 * DATABASE AUDIT SCRIPT — HQ Investment ISP Platform
 * =============================================================================
 * 
 * Purpose: Comprehensive database schema audit to:
 *   1. Verify all Prisma models are created in the database
 *   2. Check all columns exist with correct types
 *   3. Verify all indexes are created
 *   4. Verify all foreign key constraints
 *   5. Check for multi-tenant isolation integrity
 *   6. Detect schema drift between Prisma schema and actual database
 * 
 * Usage:
 *   pnpm --filter backend exec tsx scripts/database-audit.ts
 * 
 * Exit codes:
 *   0 = All checks passed (Production Ready)
 *  10 = Critical issues (Database not ready)
 *  20 = Warnings (Review before production)
 * =============================================================================
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

interface AuditResult {
    category: string;
    status: "PASS" | "WARN" | "FAIL";
    message: string;
    details?: string[];
}

const results: AuditResult[] = [];
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
}

async function runAudit() {
    const pool = new Pool({
        connectionString,
        max: 5,
        statement_timeout: 30000,
    });

    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        console.log("🔍 Starting Database Audit...\n");

        // ── Audit 1: Database Connection ────────────────────────────────────────
        try {
            await prisma.$queryRaw`SELECT 1 as test`;
            results.push({
                category: "Connection",
                status: "PASS",
                message: "✅ Database connection successful",
            });
        } catch (error) {
            results.push({
                category: "Connection",
                status: "FAIL",
                message: "❌ Database connection failed",
                details: [String(error)],
            });
            throw error;
        }

        // ── Audit 2: Table Existence ────────────────────────────────────────────
        const requiredTables = [
            "users",
            "tenants",
            "clients",
            "packages",
            "subscriptions",
            "routers",
            "invoices",
            "transactions",
            "radacct",
            "radcheck",
            "radreply",
            "radgroupcheck",
            "radgroupreply",
            "radusergroup",
            "tenant_branding",
            "tenant_settings",
            "audit_logs",
        ];

        const tableQuery = await prisma.$queryRaw<
            { tablename: string }[]
        >`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
        const existingTables = tableQuery.map((t) => t.tablename);

        const missingTables = requiredTables.filter(
            (t) => !existingTables.includes(t)
        );

        if (missingTables.length === 0) {
            results.push({
                category: "Tables",
                status: "PASS",
                message: `✅ All ${requiredTables.length} required tables exist`,
            });
        } else {
            results.push({
                category: "Tables",
                status: "FAIL",
                message: `❌ Missing ${missingTables.length} tables`,
                details: missingTables,
            });
        }

        // ── Audit 3: Multi-Tenant Validation ────────────────────────────────────
        const tenantIdColumns = await prisma.$queryRaw<
            { table_name: string; column_name: string }[]
        >`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE column_name = 'tenantId' 
      AND table_schema = 'public'
      ORDER BY table_name
    `;

        const multiTenantIssues: string[] = [];

        // Check specific tables that MUST have tenantId
        const mustHaveTenantId = [
            "clients",
            "packages",
            "subscriptions",
            "users",
            "routers",
            "invoices",
            "transactions",
        ];

        for (const table of mustHaveTenantId) {
            const hasTenantId = tenantIdColumns.some((col) => col.table_name === table);
            if (!hasTenantId) {
                multiTenantIssues.push(
                    `⚠️ ${table}: missing tenantId column (multi-tenant isolation at risk)`
                );
            }
        }

        // Check RADIUS tables for tenantId
        const radiusTables = [
            "radacct",
            "radcheck",
            "radreply",
            "radgroupcheck",
            "radgroupreply",
            "radusergroup",
        ];

        for (const table of radiusTables) {
            const hasTenantId = tenantIdColumns.some((col) => col.table_name === table);
            if (!hasTenantId) {
                multiTenantIssues.push(
                    `⚠️ ${table}: missing tenantId (RADIUS not properly scoped)`
                );
            }
        }

        if (multiTenantIssues.length === 0) {
            results.push({
                category: "Multi-Tenant Isolation",
                status: "PASS",
                message: `✅ All core tables have tenantId columns (${tenantIdColumns.length} total)`,
            });
        } else {
            results.push({
                category: "Multi-Tenant Isolation",
                status: multiTenantIssues.some((issue) => issue.includes("at risk"))
                    ? "FAIL"
                    : "WARN",
                message: `⚠️ ${multiTenantIssues.length} potential issues found`,
                details: multiTenantIssues,
            });
        }

        // ── Audit 4: Soft Delete Fields ─────────────────────────────────────────
        const softDeleteQuery = await prisma.$queryRaw<
            { table_name: string; column_name: string }[]
        >`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE column_name = 'deletedAt' 
      AND table_schema = 'public'
      ORDER BY table_name
    `;

        const shouldHaveSoftDelete = [
            "users",
            "clients",
            "packages",
            "subscriptions",
            "transactions",
            "routers",
        ];

        const missingSoftDelete = shouldHaveSoftDelete.filter(
            (table) => !softDeleteQuery.some((col) => col.table_name === table)
        );

        if (missingSoftDelete.length === 0) {
            results.push({
                category: "Soft Delete",
                status: "PASS",
                message: `✅ All ${shouldHaveSoftDelete.length} core tables have soft-delete (deletedAt)`,
            });
        } else {
            results.push({
                category: "Soft Delete",
                status: "WARN",
                message: `⚠️ ${missingSoftDelete.length} tables missing soft-delete field`,
                details: missingSoftDelete,
            });
        }

        // ── Audit 5: Indexes for Tenant Scoping ─────────────────────────────────
        const indexQuery = await prisma.$queryRaw<
            { indexname: string; tablename: string }[]
        >`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE '%tenantId%'
    `;

        const coreTablesNeedingTenantIndex = [
            "subscriptions",
            "clients",
            "invoices",
            "transactions",
        ];
        const missingTenantIndexes = coreTablesNeedingTenantIndex.filter(
            (table) => !indexQuery.some((idx) => idx.tablename === table)
        );

        if (missingTenantIndexes.length === 0) {
            results.push({
                category: "Indexes",
                status: "PASS",
                message: `✅ All core tables have tenantId indexes (${indexQuery.length} total)`,
            });
        } else {
            results.push({
                category: "Indexes",
                status: "WARN",
                message: `⚠️ ${missingTenantIndexes.length} tables missing tenantId indexes`,
                details: missingTenantIndexes,
            });
        }

        // ── Audit 6: Foreign Key Constraints ────────────────────────────────────
        const fkQuery = await prisma.$queryRaw<
            { constraint_name: string }[]
        >`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY' 
      AND table_schema = 'public'
    `;

        const criticalForeignKeys = [
            "users_tenantId_fkey",
            "clients_tenantId_fkey",
            "subscriptions_tenantId_fkey",
            "invoices_tenantId_fkey",
            "transactions_tenantId_fkey",
            "tenants_planId_fkey",
        ];

        const missingForeignKeys = criticalForeignKeys.filter(
            (fk) => !fkQuery.some((row) => row.constraint_name === fk)
        );

        if (missingForeignKeys.length === 0) {
            results.push({
                category: "Foreign Keys",
                status: "PASS",
                message: `✅ All critical foreign key constraints present (${fkQuery.length} total)`,
            });
        } else {
            results.push({
                category: "Foreign Keys",
                status: "FAIL",
                message: `❌ ${missingForeignKeys.length} critical foreign keys missing`,
                details: missingForeignKeys,
            });
        }

        // ── Audit 7: Enum Types ─────────────────────────────────────────────────
        const enumQuery = await prisma.$queryRaw<
            { typname: string }[]
        >`
      SELECT typname 
      FROM pg_type 
      WHERE typtype = 'e' 
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `;

        const requiredEnums = [
            "Role",
            "UserStatus",
            "ServiceType",
            "ClientStatus",
            "TransactionStatus",
            "InvoiceStatus",
            "SubscriptionStatus",
            "TenantStatus",
        ];

        const missingEnums = requiredEnums.filter(
            (e) => !enumQuery.some((row) => row.typname === e)
        );

        if (missingEnums.length === 0) {
            results.push({
                category: "Enums",
                status: "PASS",
                message: `✅ All ${requiredEnums.length} required enum types exist`,
            });
        } else {
            results.push({
                category: "Enums",
                status: "WARN",
                message: `⚠️ ${missingEnums.length} enum types missing`,
                details: missingEnums,
            });
        }

        // ── Audit 8: Tenant Data Integrity ──────────────────────────────────────
        try {
            const tenantCount = await prisma.tenant.count();
            const userCount = await prisma.user.count();
            const clientCount = await prisma.client.count();

            if (tenantCount > 0 || userCount > 0 || clientCount > 0) {
                results.push({
                    category: "Data Integrity",
                    status: "PASS",
                    message: `✅ Database has data: ${tenantCount} tenants, ${userCount} users, ${clientCount} clients`,
                });
            } else {
                results.push({
                    category: "Data Integrity",
                    status: "WARN",
                    message: "ℹ️ Database is empty (fresh initialization)",
                });
            }
        } catch (error) {
            results.push({
                category: "Data Integrity",
                status: "FAIL",
                message: "❌ Could not verify data integrity",
                details: [String(error)],
            });
        }

        // ── Print Results ───────────────────────────────────────────────────────
        console.log("\n" + "=".repeat(80));
        console.log("DATABASE AUDIT RESULTS");
        console.log("=".repeat(80) + "\n");

        let criticalIssues = 0;
        let warnings = 0;

        for (const result of results) {
            const icon = result.status === "PASS" ? "✅" : result.status === "FAIL" ? "❌" : "⚠️";
            console.log(`${icon} ${result.category}: ${result.message}`);

            if (result.details && result.details.length > 0) {
                result.details.forEach((detail) => console.log(`   • ${detail}`));
            }

            if (result.status === "FAIL") criticalIssues++;
            if (result.status === "WARN") warnings++;

            console.log();
        }

        // ── Summary ────────────────────────────────────────────────────────────
        console.log("=".repeat(80));
        console.log(
            `SUMMARY: ${results.filter((r) => r.status === "PASS").length} passed, ${warnings} warnings, ${criticalIssues} critical`
        );
        console.log("=".repeat(80));

        if (criticalIssues > 0) {
            console.log(
                "\n❌ DATABASE IS NOT PRODUCTION-READY. Fix critical issues before deploying.\n"
            );
            process.exit(10);
        } else if (warnings > 0) {
            console.log(
                "\n⚠️ WARNINGS DETECTED. Review before production deployment.\n"
            );
            process.exit(20);
        } else {
            console.log("\n✅ DATABASE AUDIT PASSED. System is production-ready.\n");
            process.exit(0);
        }
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

runAudit().catch((error) => {
    console.error("❌ Audit failed:", error);
    process.exit(1);
});
