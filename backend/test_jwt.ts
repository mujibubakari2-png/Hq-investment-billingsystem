
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-for-dev-only-123";

const payload = {
    userId: "123",
    username: "admin",
    role: "ADMIN",
    tenantId: "tenant_admin",
};

const enhancedPayload = {
    ...payload,
    tenant_id: payload.tenantId,
};

const token = jwt.sign(enhancedPayload, JWT_SECRET, { expiresIn: "7d" });
console.log("TOKEN:", token);

const decoded = jwt.decode(token);
console.log("DECODED:", JSON.stringify(decoded, null, 2));
