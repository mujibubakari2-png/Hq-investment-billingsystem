import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "kenge-isp-secret-key-change-in-production-2026";

const payload = {
    userId: "admin_user_id", // Dummy ID
    username: "admin",
    role: "SUPER_ADMIN",
    tenantId: "tenant_admin" // Matching the tenant_admin for "tandika" router
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
console.log(token);
