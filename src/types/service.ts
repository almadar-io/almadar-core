/**
 * Service Types for Orbital Schema
 *
 * Defines external service integrations (REST APIs, WebSockets, MCP servers)
 * that can be used by orbital units via the `call_service` effect.
 *
 * @packageDocumentation
 */

import { z } from "zod";

// ============================================================================
// Service Type Enum
// ============================================================================

/**
 * Types of external services that can be integrated.
 */
export const SERVICE_TYPES = ["rest", "socket", "mcp"] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const ServiceTypeSchema = z.enum(SERVICE_TYPES);

// ============================================================================
// REST Service Definition
// ============================================================================

/**
 * Configuration for a REST API service.
 *
 * @example
 * ```typescript
 * const weatherService: RestServiceDef = {
 *   name: 'WeatherAPI',
 *   type: 'rest',
 *   baseUrl: 'https://api.openweathermap.org/data/2.5',
 *   headers: {
 *     'Content-Type': 'application/json',
 *   },
 *   auth: {
 *     type: 'api-key',
 *     keyName: 'appid',
 *     location: 'query',
 *   },
 * };
 * ```
 */
export interface RestServiceDef {
  /** Unique service name (used in call_service effect) */
  name: string;

  /** Service type */
  type: "rest";

  /** Optional description */
  description?: string;

  /** Base URL for the API */
  baseUrl: string;

  /** Default headers to include in all requests */
  headers?: Record<string, string>;

  /** Authentication configuration */
  auth?: RestAuthConfig;

  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Authentication configuration for REST services.
 */
export interface RestAuthConfig {
  /** Authentication type */
  type: "api-key" | "bearer" | "basic" | "oauth2";

  /** For api-key: the query parameter or header name */
  keyName?: string;

  /** For api-key: where to place the key */
  location?: "query" | "header";

  /** Environment variable name containing the secret (for secure storage) */
  secretEnv?: string;
}

export const RestAuthConfigSchema = z.object({
  type: z.enum(["api-key", "bearer", "basic", "oauth2"]),
  keyName: z.string().optional(),
  location: z.enum(["query", "header"]).optional(),
  secretEnv: z.string().optional(),
});

export const RestServiceDefSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  type: z.literal("rest"),
  description: z.string().optional(),
  baseUrl: z.string().url("Base URL must be a valid URL"),
  headers: z.record(z.string()).optional(),
  auth: RestAuthConfigSchema.optional(),
  timeout: z.number().positive().optional(),
});

// ============================================================================
// Socket Service Definition
// ============================================================================

/**
 * Configuration for a WebSocket service.
 *
 * @example
 * ```typescript
 * const chatService: SocketServiceDef = {
 *   name: 'ChatSocket',
 *   type: 'socket',
 *   url: 'wss://chat.example.com',
 *   events: {
 *     inbound: ['message_received', 'user_joined', 'user_left'],
 *     outbound: ['send_message', 'join_room', 'leave_room'],
 *   },
 * };
 * ```
 */
export interface SocketServiceDef {
  /** Unique service name */
  name: string;

  /** Service type */
  type: "socket";

  /** Optional description */
  description?: string;

  /** WebSocket URL */
  url: string;

  /** Event definitions */
  events: SocketEvents;

  /** Reconnection configuration */
  reconnect?: {
    /** Enable automatic reconnection */
    enabled: boolean;
    /** Maximum reconnection attempts */
    maxAttempts?: number;
    /** Delay between attempts in ms */
    delayMs?: number;
  };
}

/**
 * Socket event definitions.
 */
export interface SocketEvents {
  /** Events received from server (maps to orbital events) */
  inbound: string[];

  /** Events sent to server (triggered by effects) */
  outbound: string[];
}

export const SocketEventsSchema = z.object({
  inbound: z.array(z.string()),
  outbound: z.array(z.string()),
});

export const SocketServiceDefSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  type: z.literal("socket"),
  description: z.string().optional(),
  url: z.string().url("WebSocket URL must be valid"),
  events: SocketEventsSchema,
  reconnect: z
    .object({
      enabled: z.boolean(),
      maxAttempts: z.number().positive().optional(),
      delayMs: z.number().positive().optional(),
    })
    .optional(),
});

// ============================================================================
// MCP Service Definition
// ============================================================================

/**
 * Configuration for an MCP (Model Context Protocol) server.
 *
 * @example
 * ```typescript
 * const mcpService: McpServiceDef = {
 *   name: 'DatabaseMCP',
 *   type: 'mcp',
 *   serverPath: './mcp-servers/database',
 *   capabilities: ['query', 'insert', 'update'],
 * };
 * ```
 */
export interface McpServiceDef {
  /** Unique service name */
  name: string;

  /** Service type */
  type: "mcp";

  /** Optional description */
  description?: string;

  /** Path to MCP server executable or module */
  serverPath: string;

  /** List of capabilities/tools exposed by the MCP server */
  capabilities: string[];

  /** Environment variables to pass to the MCP server */
  env?: Record<string, string>;
}

export const McpServiceDefSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  type: z.literal("mcp"),
  description: z.string().optional(),
  serverPath: z.string().min(1, "Server path is required"),
  capabilities: z
    .array(z.string())
    .min(1, "At least one capability is required"),
  env: z.record(z.string()).optional(),
});

// ============================================================================
// Union Type: ServiceDefinition
// ============================================================================

/**
 * Union type for all service definitions.
 */
export type ServiceDefinition =
  | RestServiceDef
  | SocketServiceDef
  | McpServiceDef;

export const ServiceDefinitionSchema = z.discriminatedUnion("type", [
  RestServiceDefSchema,
  SocketServiceDefSchema,
  McpServiceDefSchema,
]);

// ============================================================================
// Service Reference (Inline OR Reference)
// ============================================================================

/**
 * ServiceRef - Service can be inline definition OR reference to imported service.
 *
 * Reference format: "Alias.services.ServiceName"
 */
export type ServiceRef = ServiceDefinition | string;

/**
 * Check if ServiceRef is a reference string.
 */
export function isServiceReference(service: ServiceRef): service is string {
  return typeof service === "string";
}

/**
 * Validate service reference format: "Alias.services.ServiceName"
 */
export const ServiceRefStringSchema = z
  .string()
  .regex(
    /^[A-Z][a-zA-Z0-9]*\.services\.[a-zA-Z][a-zA-Z0-9]*$/,
    'Service reference must be in format "Alias.services.ServiceName" (e.g., "Weather.services.openweather")',
  );

export const ServiceRefSchema = z.union([
  ServiceDefinitionSchema,
  ServiceRefStringSchema,
]);

/**
 * Parse a service reference.
 * @returns { alias, serviceName } or null if not a valid reference
 */
export function parseServiceRef(
  ref: string,
): { alias: string; serviceName: string } | null {
  const match = ref.match(
    /^([A-Z][a-zA-Z0-9]*)\.services\.([a-zA-Z][a-zA-Z0-9]*)$/,
  );
  if (!match) return null;
  return { alias: match[1], serviceName: match[2] };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a service definition is a REST service.
 */
export function isRestService(
  service: ServiceDefinition,
): service is RestServiceDef {
  return service.type === "rest";
}

/**
 * Check if a service definition is a Socket service.
 */
export function isSocketService(
  service: ServiceDefinition,
): service is SocketServiceDef {
  return service.type === "socket";
}

/**
 * Check if a service definition is an MCP service.
 */
export function isMcpService(
  service: ServiceDefinition,
): service is McpServiceDef {
  return service.type === "mcp";
}

/**
 * Get all service names from a list of services.
 */
export function getServiceNames(services: ServiceDefinition[]): string[] {
  return services.map((s) => s.name);
}

/**
 * Find a service by name.
 */
export function findService(
  services: ServiceDefinition[],
  name: string,
): ServiceDefinition | undefined {
  return services.find((s) => s.name.toLowerCase() === name.toLowerCase());
}

/**
 * Check if a service name exists (case-insensitive).
 */
export function hasService(
  services: ServiceDefinition[],
  name: string,
): boolean {
  return services.some((s) => s.name.toLowerCase() === name.toLowerCase());
}
