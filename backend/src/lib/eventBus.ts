/**
 * Redis Streams Event Bus
 *
 * ENTERPRISE-013: Carrier-Grade Event Streaming
 * Replaces pure DB polling with real-time Redis Streams (XADD) for event propagation.
 *
 * Provides a standardized event envelope:
 * {
 *   eventId: UUID,
 *   eventType: string,
 *   tenantId: string,
 *   routerId: string,
 *   timestamp: ISO-8601 string,
 *   correlationId: string,
 *   payload: JSON string
 * }
 */

import { getRedisConnection } from "./queue";
import { randomUUID } from "crypto";
import logger from "./logger";

export type EventType = 
    | "ROUTER_DISCOVERED" 
    | "PROVISIONING_STARTED" 
    | "PROVISIONING_STEP_COMPLETED" 
    | "PROVISIONING_COMPLETED" 
    | "PROVISIONING_FAILED"
    | "CONFIG_DRIFT_DETECTED"
    | "BACKUP_COMPLETED"
    | "ROUTER_OFFLINE"
    | "ROUTER_ONLINE";

export interface EventEnvelope {
    eventId: string;
    eventType: EventType;
    tenantId: string | null;
    routerId: string | null;
    timestamp: string;
    correlationId: string | null;
    payload: any;
}

const STREAM_KEY = "isp:events:main";
const DEAD_LETTER_STREAM = "isp:events:dlq";

/**
 * Publish an event to the Redis Stream.
 * Allows consumers (e.g. WebSocket gateways) to subscribe in real-time.
 */
export async function publishEvent(event: Omit<EventEnvelope, "eventId" | "timestamp">): Promise<void> {
    const fullEvent: EventEnvelope = {
        ...event,
        eventId: randomUUID(),
        timestamp: new Date().toISOString()
    };

    const redis = getRedisConnection();
    try {
        // XADD isp:events:main * eventId <uuid> eventType <type> ... payload <json>
        await (redis as any).xadd(
            STREAM_KEY,
            "*", 
            "eventId", fullEvent.eventId,
            "eventType", fullEvent.eventType,
            "tenantId", fullEvent.tenantId ?? "GLOBAL",
            "routerId", fullEvent.routerId ?? "NONE",
            "timestamp", fullEvent.timestamp,
            "correlationId", fullEvent.correlationId ?? "NONE",
            "payload", JSON.stringify(fullEvent.payload)
        );
    } catch (err: any) {
        logger.error(`[EventBus] Failed to publish event ${event.eventType}: ${err.message}`);
        // Fallback: dump to DLQ stream on failure?
        // If Redis itself is down, this will also fail. It's a best-effort event bus.
    }
}

/**
 * Moves an event to the Dead Letter Queue for later inspection.
 */
export async function publishToDLQ(eventData: any, errorReason: string): Promise<void> {
    const redis = getRedisConnection();
    try {
        await (redis as any).xadd(
            DEAD_LETTER_STREAM,
            "*",
            "reason", errorReason,
            "payload", JSON.stringify(eventData),
            "timestamp", new Date().toISOString()
        );
    } catch (err: any) {
        logger.error(`[EventBus] Failed to publish to DLQ: ${err.message}`);
    }
}
