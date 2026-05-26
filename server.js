/**
 * ============================================================================
 *  SOFTWARE GENERATION COMPILER PIPELINE  —  server.js
 *  Node.js | Express | Zod | @google/genai (Gemini 2.5 Flash)
 * ============================================================================
 *
 *  Five integrated subsystems:
 *    1. STRICT DATA TYPE STRUCTS          (Zod schemas for every stage)
 *    2. DETERMINISTIC MULTI-STAGE PIPELINE ENGINE
 *    3. PROGRAMMATIC CROSS-LAYER CONSISTENCY VALIDATOR
 *    4. SURGICAL SELF-REPAIR ENGINE
 *    5. COST, LATENCY & PERFORMANCE METRICS LOGGER
 *
 *  Endpoint: POST /api/compile
 *  Body:     { "prompt": "<natural-language system description>" }
 * ============================================================================
 */

"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// LOAD .env  (must be first — before any process.env reads)
// ─────────────────────────────────────────────────────────────────────────────
require("dotenv").config();

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
const express    = require("express");
const cors       = require("cors");
const { z }      = require("zod");
const { GoogleGenAI } = require("@google/genai");
const { performance } = require("perf_hooks");

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const PORT        = process.env.PORT || 3000;
const GEMINI_KEY  = process.env.GEMINI_API_KEY || "";
const MODEL_ID    = process.env.MODEL_ID || "gemini-2.5-flash"; // Configurable via environment, fallback to 2.5 Flash
const MAX_REPAIRS = 3; // Maximum surgical self-repair attempts per stage

// Approximate cost table (USD per 1 million tokens)
const COST_TABLE = {
  inputTokensPerMillion:  0.15, // Gemini 2.5 Flash input
  outputTokensPerMillion: 0.60, // Gemini 2.5 Flash output
};

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE GENAI CLIENT
// ─────────────────────────────────────────────────────────────────────────────
const genai = new GoogleGenAI({ apiKey: GEMINI_KEY });

// ─────────────────────────────────────────────────────────────────────────────
//  ███████╗████████╗ █████╗  ██████╗ ███████╗     1
//  ██╔════╝╚══██╔══╝██╔══██╗██╔════╝ ██╔════╝
//  ███████╗   ██║   ███████║██║  ███╗█████╗
//  ╚════██║   ██║   ██╔══██║██║   ██║██╔══╝
//  ███████║   ██║   ██║  ██║╚██████╔╝███████╗
//  ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝
//  STRICT DATA TYPE STRUCTS — ZOD SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

// ── Stage 1: Intent Extraction ────────────────────────────────────────────────
const IntentExtractionSchema = z.object({
  entities: z.array(
    z.object({
      name:        z.string().min(1),
      description: z.string(),
      attributes:  z.array(z.string()).min(1),
    })
  ).min(1),
  userRoles: z.array(
    z.object({
      role:        z.string().min(1),
      description: z.string(),
      permissions: z.array(z.string()),
    })
  ).min(1),
  coreFeatures: z.array(
    z.object({
      featureName: z.string().min(1),
      description: z.string(),
      involvedEntities: z.array(z.string()),
      requiredRoles:    z.array(z.string()),
    })
  ).min(1),
});

// ── Stage 2: System Design ────────────────────────────────────────────────────
const SystemDesignSchema = z.object({
  entities: z.array(
    z.object({
      name:       z.string().min(1),
      fields:     z.array(z.string()).min(1),
      primaryKey: z.string().min(1),
    })
  ).min(1),
  relationships: z.array(
    z.object({
      from:        z.string().min(1),
      to:          z.string().min(1),
      type:        z.enum(["one-to-one", "one-to-many", "many-to-many"]),
      description: z.string(),
    })
  ),
  systemRoles: z.array(
    z.object({
      role:   z.string().min(1),
      level:  z.number().int().nonnegative(),
      scopes: z.array(z.string()),
    })
  ).min(1),
  accessMatrix: z.record(
    z.string(),   // entity name
    z.record(
      z.string(), // role
      z.array(z.enum(["create", "read", "update", "delete"]))
    )
  ),
});

// ── Stage 3: Schema Generation ────────────────────────────────────────────────
const UIPageSchema = z.object({
  path:        z.string().min(1),
  name:        z.string().min(1),
  isGated:     z.boolean(),
  gatedRoles:  z.array(z.string()),
  components:  z.array(
    z.object({
      componentName: z.string().min(1),
      fields:        z.array(z.string()),
      bindsToEntity: z.string(),
    })
  ),
});

const UILayoutSchema = z.object({
  appName:     z.string().min(1),
  navLinks:    z.array(z.string()),
  pages:       z.array(UIPageSchema).min(1),
});

const APIRouteSchema = z.object({
  path:     z.string().min(1),
  method:   z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  auth:     z.boolean(),
  roles:    z.array(z.string()),
  requestPayload:  z.record(z.string(), z.string()).optional(),
  responsePayload: z.record(z.string(), z.string()),
  entity:   z.string().min(1),
});

const DBColumnSchema = z.object({
  name:       z.string().min(1),
  type:       z.string().min(1),
  nullable:   z.boolean(),
  unique:     z.boolean().optional(),
  default:    z.string().optional(),
});

const DBTableSchema = z.object({
  tableName:   z.string().min(1),
  entity:      z.string().min(1),
  columns:     z.array(DBColumnSchema).min(1),
  foreignKeys: z.array(
    z.object({
      column:           z.string().min(1),
      referencesTable:  z.string().min(1),
      referencesColumn: z.string().min(1),
    })
  ).optional(),
});

const AuthRolePermissionSchema = z.object({
  role:        z.string().min(1),
  allowedRoutes: z.array(z.string()),
  deniedRoutes:  z.array(z.string()),
  tokenExpiry:   z.string(),
});

const SchemaGenerationSchema = z.object({
  uiSchema: z.object({
    layout: UILayoutSchema,
    pages:  z.array(UIPageSchema).min(1),
  }),
  apiSchema: z.object({
    basePath: z.string(),
    routes:   z.array(APIRouteSchema).min(1),
  }),
  dbSchema: z.object({
    dialect: z.string(),
    tables:  z.array(DBTableSchema).min(1),
  }),
  authSchema: z.object({
    strategy:        z.string(),
    rolePermissions: z.array(AuthRolePermissionSchema).min(1),
  }),
});

// ── Stage 4: Final Refined Package ───────────────────────────────────────────
const FinalRefinedSchema = z.object({
  ui:   UILayoutSchema,
  api:  z.object({
    basePath: z.string(),
    routes:   z.array(APIRouteSchema).min(1),
  }),
  db: z.object({
    dialect: z.string(),
    tables:  z.array(DBTableSchema).min(1),
  }),
  auth: z.object({
    strategy:        z.string(),
    rolePermissions: z.array(AuthRolePermissionSchema).min(1),
  }),
  systemAssumptions: z.array(
    z.object({
      id:          z.string().min(1),
      assumption:  z.string().min(1),
      rationale:   z.string(),
      affectedLayers: z.array(z.enum(["ui", "api", "db", "auth"])),
    })
  ).min(1),
});

// ─────────────────────────────────────────────────────────────────────────────
//  ███████╗████████╗ █████╗  ██████╗ ███████╗     5
//  COST, LATENCY & PERFORMANCE METRICS LOGGER
//  (Defined early — used inside the pipeline engine)
// ─────────────────────────────────────────────────────────────────────────────

class MetricsLogger {
  constructor() {
    this.stages   = [];
    this.repairs  = [];
    this.totalInputTokens  = 0;
    this.totalOutputTokens = 0;
    this._pipelineStart    = performance.now();
  }

  /**
   * Record a completed stage's telemetry.
   * @param {string} stageName
   * @param {number} startMs - performance.now() at stage start
   * @param {number} endMs   - performance.now() at stage end
   * @param {object} usageMeta - { inputTokens, outputTokens } from response (or estimates)
   * @param {number} repairsUsed
   */
  recordStage(stageName, startMs, endMs, usageMeta = {}, repairsUsed = 0) {
    const latencyMs      = +(endMs - startMs).toFixed(3);
    const inputTokens    = usageMeta.inputTokens  || 0;
    const outputTokens   = usageMeta.outputTokens || 0;
    const inputCost      = (inputTokens  / 1_000_000) * COST_TABLE.inputTokensPerMillion;
    const outputCost     = (outputTokens / 1_000_000) * COST_TABLE.outputTokensPerMillion;
    const stageCostUSD   = +(inputCost + outputCost).toFixed(8);

    this.totalInputTokens  += inputTokens;
    this.totalOutputTokens += outputTokens;

    const entry = {
      stageName,
      latencyMs,
      inputTokens,
      outputTokens,
      stageCostUSD,
      repairsUsed,
      timestamp: new Date().toISOString(),
    };
    this.stages.push(entry);
    return entry;
  }

  /**
   * Record a self-repair event.
   */
  recordRepair(stageName, repairAttempt, errorType, errorSummary) {
    const entry = {
      stageName,
      repairAttempt,
      errorType,
      errorSummary,
      timestamp: new Date().toISOString(),
    };
    this.repairs.push(entry);
    return entry;
  }

  /**
   * Compile and return the final telemetry summary object.
   */
  summarize() {
    const totalPipelineLatencyMs = +(performance.now() - this._pipelineStart).toFixed(3);
    const totalInputCost  = (this.totalInputTokens  / 1_000_000) * COST_TABLE.inputTokensPerMillion;
    const totalOutputCost = (this.totalOutputTokens / 1_000_000) * COST_TABLE.outputTokensPerMillion;
    const totalCostUSD    = +(totalInputCost + totalOutputCost).toFixed(8);

    return {
      totalPipelineLatencyMs,
      totalInputTokens:  this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalCostUSD,
      costBreakdown: {
        inputCostUSD:  +totalInputCost.toFixed(8),
        outputCostUSD: +totalOutputCost.toFixed(8),
        ratePer1MInputTokensUSD:  COST_TABLE.inputTokensPerMillion,
        ratePer1MOutputTokensUSD: COST_TABLE.outputTokensPerMillion,
      },
      model: MODEL_ID,
      stages: this.stages,
      repairs: this.repairs,
      totalRepairs: this.repairs.length,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ███████╗████████╗ █████╗  ██████╗ ███████╗     3
//  PROGRAMMATIC CROSS-LAYER CONSISTENCY VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CrossLayerValidationError — rich structured error with per-mismatch details.
 */
class CrossLayerValidationError extends Error {
  constructor(mismatches) {
    super(`Cross-layer consistency validation failed with ${mismatches.length} mismatch(es).`);
    this.name       = "CrossLayerValidationError";
    this.mismatches = mismatches; // Array<{ rule, path, detail, severity }>
    this.stack      = this._buildDetailedStack();
  }

  _buildDetailedStack() {
    const lines = [
      `CrossLayerValidationError: ${this.message}`,
      "",
      "── MISMATCH REPORT ──────────────────────────────────────────────────────",
    ];
    this.mismatches.forEach((m, i) => {
      lines.push(`[${i + 1}] Rule     : ${m.rule}`);
      lines.push(`    Path     : ${m.path}`);
      lines.push(`    Detail   : ${m.detail}`);
      lines.push(`    Severity : ${m.severity}`);
      lines.push("");
    });
    lines.push("─────────────────────────────────────────────────────────────────────────");
    return lines.join("\n");
  }

  toJSON() {
    return {
      error:      this.name,
      message:    this.message,
      mismatches: this.mismatches,
    };
  }
}

/**
 * validateCrossLayerConsistency
 *
 * Three assertion groups:
 *   A) Every UI field → matching API endpoint/payload attribute
 *   B) Every API payload field → existing DB column
 *   C) Every gated UI route → corresponding auth permission rule
 *
 * @param {z.infer<typeof SchemaGenerationSchema>} schemas
 * @throws {CrossLayerValidationError}
 */
function validateCrossLayerConsistency(schemas) {
  const mismatches = [];

  const { uiSchema, apiSchema, dbSchema, authSchema } = schemas;

  // ── Build lookup maps ──────────────────────────────────────────────────────

  // API: map entity → set of payload fields (request + response)
  const apiEntityFields = new Map(); // Map<entity, Set<field>>
  // API: map route path → route definition
  const apiRouteMap     = new Map(); // Map<path, APIRouteSchema>

  for (const route of apiSchema.routes) {
    apiRouteMap.set(route.path, route);
    const fields = apiEntityFields.get(route.entity) || new Set();
    if (route.requestPayload) {
      Object.keys(route.requestPayload).forEach(f => fields.add(f));
    }
    Object.keys(route.responsePayload).forEach(f => fields.add(f));
    apiEntityFields.set(route.entity, fields);
  }

  // DB: map entity → set of column names
  const dbEntityColumns = new Map(); // Map<entity, Set<columnName>>
  for (const table of dbSchema.tables) {
    const cols = new Set(table.columns.map(c => c.name));
    dbEntityColumns.set(table.entity, cols);
  }

  // Auth: flat set of all allowed routes across all roles
  const authAllowedRoutes = new Set();
  for (const rp of authSchema.rolePermissions) {
    rp.allowedRoutes.forEach(r => authAllowedRoutes.add(r));
  }

  // ── Rule A: UI field → API payload ────────────────────────────────────────
  for (const page of uiSchema.pages) {
    for (const component of page.components) {
      const entityName = component.bindsToEntity;
      const entityFields = apiEntityFields.get(entityName);

      for (const field of component.fields) {
        // Skip purely presentational meta fields
        if (["id", "createdAt", "updatedAt"].includes(field)) continue;

        if (!entityFields || !entityFields.has(field)) {
          mismatches.push({
            rule:     "UI_FIELD_MISSING_IN_API",
            path:     `uiSchema.pages[${page.path}].components[${component.componentName}].fields[${field}]`,
            detail:   `Field "${field}" bound to entity "${entityName}" on page "${page.name}" (${page.path}) has no matching attribute in any API route payload for entity "${entityName}". ` +
                      `Available API fields for this entity: [${entityFields ? [...entityFields].join(", ") : "none"}].`,
            severity: "ERROR",
          });
        }
      }
    }
  }

  // ── Rule B: API payload field → DB column ─────────────────────────────────
  for (const route of apiSchema.routes) {
    const dbCols = dbEntityColumns.get(route.entity);
    const payloadFields = new Set([
      ...Object.keys(route.requestPayload  || {}),
      ...Object.keys(route.responsePayload || {}),
    ]);

    for (const field of payloadFields) {
      // Skip standard meta/pagination fields
      if (["id", "token", "accessToken", "refreshToken", "page", "limit", "totalCount", "message", "success"].includes(field)) continue;

      if (!dbCols || !dbCols.has(field)) {
        mismatches.push({
          rule:     "API_PAYLOAD_FIELD_MISSING_IN_DB",
          path:     `apiSchema.routes[${route.method} ${route.path}].payload[${field}]`,
          detail:   `Payload field "${field}" for entity "${route.entity}" on route "${route.method} ${route.path}" has no matching column in the DB table for entity "${route.entity}". ` +
                    `Available DB columns: [${dbCols ? [...dbCols].join(", ") : "none"}].`,
          severity: "ERROR",
        });
      }
    }
  }

  // ── Rule C: Gated UI route → Auth permission ──────────────────────────────
  for (const page of uiSchema.pages) {
    if (page.isGated) {
      // Check if auth has an explicit allowedRoutes entry covering this page
      const covered = authSchema.rolePermissions.some(rp =>
        rp.allowedRoutes.some(ar => ar === page.path || ar === "*")
      );

      if (!covered) {
        mismatches.push({
          rule:     "GATED_UI_ROUTE_MISSING_AUTH_PERMISSION",
          path:     `uiSchema.pages[${page.path}]`,
          detail:   `Page "${page.name}" at path "${page.path}" is marked isGated=true for roles [${page.gatedRoles.join(", ")}], ` +
                    `but no role in authSchema.rolePermissions has this path listed in its allowedRoutes. ` +
                    `Currently authorised routes: [${[...authAllowedRoutes].join(", ")}].`,
          severity: "ERROR",
        });
      }
    }
  }

  if (mismatches.length > 0) {
    throw new CrossLayerValidationError(mismatches);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER: Extract raw JSON from model response text
// ─────────────────────────────────────────────────────────────────────────────

/**
 * stripToJSON
 * The model might wrap JSON in markdown fences despite instructions.
 * This strips any ``` fences and trims surrounding whitespace.
 */
function stripToJSON(rawText) {
  if (!rawText) throw new Error("Model returned empty content.");

  let cleaned = rawText.trim();

  // Remove markdown code fences (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Attempt to extract the outermost JSON object if there is surrounding prose
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd   = cleaned.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  return cleaned;
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER: Call Gemini with system instruction + user prompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * callGemini
 * @param {string} systemInstruction - Compiler module directive
 * @param {string} userPrompt        - Contextual data for this stage
 * @returns {{ text: string, inputTokens: number, outputTokens: number }}
 */
async function callGemini(systemInstruction, userPrompt, retriesLeft = 3, delayMs = 2000) {
  try {
    const response = await genai.models.generateContent({
      model: MODEL_ID,
      config: {
        systemInstruction,
        temperature: 0,  // Deterministic — no sampling randomness
        topP:        1,
        topK:        1,
      },
      contents: [
        { role: "user", parts: [{ text: userPrompt }] },
      ],
    });

    const text = response.text ?? "";

    // Extract token usage — SDK may expose these under usageMetadata
    const usage = response.usageMetadata || {};
    const inputTokens  = usage.promptTokenCount     || estimateTokens(userPrompt + systemInstruction);
    const outputTokens = usage.candidatesTokenCount || estimateTokens(text);

    return { text, inputTokens, outputTokens };
  } catch (err) {
    const status = err.status ?? err.statusCode ?? err.code;
    const msg = String(err.message || err).toLowerCase();
    
    // Classify if the error is transient:
    // - 5xx status codes
    // - String statuses: INTERNAL, UNAVAILABLE
    // - 429 / RESOURCE_EXHAUSTED (rate-limit / quota spikes)
    // - Common transient words in message
    const isTransient = 
      (typeof status === "number" && (status === 429 || (status >= 500 && status < 600))) ||
      (typeof status === "string" && ["RESOURCE_EXHAUSTED", "INTERNAL", "UNAVAILABLE"].includes(status)) ||
      msg.includes("quota") || msg.includes("rate limit") || msg.includes("temporary") || msg.includes("unavailable");

    if (isTransient && retriesLeft > 0) {
      console.warn(
        `\n⚠️ [GEMINI API] Transient error (status: ${status || "unknown"}). ` +
        `Retrying in ${delayMs}ms... (${retriesLeft} retries left). ` +
        `Reason: ${err.message || err}\n`
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return callGemini(systemInstruction, userPrompt, retriesLeft - 1, delayMs * 2);
    }
    
    // Throw error if it's non-recoverable or retries are exhausted
    throw err;
  }
}

/** Rough token estimation fallback (≈ 4 chars per token) */
function estimateTokens(text) {
  return Math.ceil((text || "").length / 4);
}

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE SYSTEM INSTRUCTIONS  (Compiler Module Directives)
// ─────────────────────────────────────────────────────────────────────────────

const COMPILER_SYSTEM_BASE = `
You are a DETERMINISTIC COMPILER MODULE. You have exactly ONE job:
output a single, strictly valid, minified JSON object that conforms to
the schema described in the user message. 

ABSOLUTE RULES — violation is a compile error:
1. Output ONLY raw minified JSON. No markdown, no prose, no comments,
   no explanations, no trailing commas, no extra whitespace.
2. Every key specified in the schema MUST be present.
3. All array fields MUST have at least one element unless explicitly
   marked optional.
4. String values must not be empty ("") unless the field is optional.
5. Enums must be exact matches (case-sensitive).
6. Do NOT invent schema keys that were not specified.
7. Treat this task like compiling source code: correctness is mandatory.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER: Classify non-recoverable API errors (bypass self-repair loop)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * isNonRecoverableApiError
 *
 * Returns true for HTTP errors where retrying with a different prompt will
 * NEVER help:
 *   429 RESOURCE_EXHAUSTED — quota/rate limit (need to wait or upgrade plan)
 *   401 UNAUTHORIZED       — bad API key
 *   403 FORBIDDEN          — key lacks permission
 *   404 NOT_FOUND          — model doesn't exist on this API version
 *   5xx SERVER_ERROR       — Google-side infrastructure failure
 *
 * Only Zod parse errors and JSON syntax errors are worth repairing.
 */
function isNonRecoverableApiError(err) {
  if (!err) return false;
  const status = err.status ?? err.statusCode ?? err.code;
  if (typeof status === "number") {
    return status === 429 || status === 401 || status === 403
        || status === 404 || (status >= 500 && status < 600);
  }
  // String-based status from the SDK (e.g. "RESOURCE_EXHAUSTED")
  if (typeof status === "string") {
    return ["RESOURCE_EXHAUSTED", "UNAUTHENTICATED", "PERMISSION_DENIED",
            "NOT_FOUND", "INTERNAL", "UNAVAILABLE"].includes(status);
  }
  // Fallback: check if the error message contains known non-recoverable phrases
  const msg = String(err.message || err).toLowerCase();
  return msg.includes("quota") || msg.includes("rate limit")
      || msg.includes("api key") || msg.includes("not found")
      || msg.includes("exceeded");
}

// ─────────────────────────────────────────────────────────────────────────────
//  ███████╗████████╗ █████╗  ██████╗ ███████╗    2 + 4
//  DETERMINISTIC MULTI-STAGE PIPELINE ENGINE
//  + SURGICAL SELF-REPAIR ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * runStage
 *
 * Executes one pipeline stage with full self-repair capability.
 *
 * @param {object} opts
 * @param {string}   opts.stageName        - Human-readable stage label
 * @param {string}   opts.systemInstruction
 * @param {string}   opts.userPrompt
 * @param {z.ZodSchema} opts.schema        - Zod schema for this stage's output
 * @param {MetricsLogger} opts.metrics
 * @param {Array}    opts.compilationHistory - Mutable history log
 * @returns {{ parsed: object, usageMeta: object }}
 */
async function runStage({ stageName, systemInstruction, userPrompt, schema, metrics, compilationHistory }) {
  const stageStart    = performance.now();
  let   repairsUsed   = 0;
  let   accInputTok   = 0;
  let   accOutputTok  = 0;
  let   lastRawText   = "";
  let   lastError     = null;

  // ── Primary attempt + repair loop ─────────────────────────────────────────
  for (let attempt = 0; attempt <= MAX_REPAIRS; attempt++) {

    let currentPrompt    = userPrompt;
    let currentInstruct  = systemInstruction;

    // ── SURGICAL SELF-REPAIR: construct repair prompt if this is a retry ───
    if (attempt > 0 && lastError !== null) {
      repairsUsed++;
      const repairType    = lastError instanceof z.ZodError ? "ZOD_VALIDATION_FAILURE"
                          : lastError instanceof CrossLayerValidationError ? "CROSS_LAYER_MISMATCH"
                          : "PARSE_ERROR";
      const errorPayload  = lastError instanceof z.ZodError
                              ? JSON.stringify(lastError.errors, null, 2)
                              : lastError instanceof CrossLayerValidationError
                                ? JSON.stringify(lastError.toJSON(), null, 2)
                                : String(lastError);

      metrics.recordRepair(stageName, attempt, repairType, errorPayload.slice(0, 400));

      compilationHistory.push({
        event:          "SELF_REPAIR_ATTEMPT",
        stageName,
        attempt,
        repairType,
        errorSummary:   errorPayload.slice(0, 600),
        malformedOutput: lastRawText.slice(0, 800),
        timestamp:      new Date().toISOString(),
      });

      // Surgical repair system instruction — focus only on broken mutations
      currentInstruct = `
${COMPILER_SYSTEM_BASE}

REPAIR MODE — SURGICAL ONLY:
You are repairing a PREVIOUS OUTPUT that failed validation.
Fix ONLY the specific mutations listed in the ERROR REPORT below.
Do NOT regenerate from scratch. Do NOT change anything not listed in the error.
Output the corrected full JSON object (same structure, minimal delta).

ERROR REPORT:
${errorPayload}

PREVIOUS MALFORMED OUTPUT:
${lastRawText}
      `.trim();

      currentPrompt = `
Repair the JSON so it passes this schema:
${userPrompt}

Return only the corrected JSON — no prose, no fences.
      `.trim();
    }

    // ── Call the model ─────────────────────────────────────────────────────
    try {
      const { text, inputTokens, outputTokens } = await callGemini(currentInstruct, currentPrompt);
      lastRawText     = text;
      accInputTok    += inputTokens;
      accOutputTok   += outputTokens;

      const cleaned   = stripToJSON(text);
      const parsed    = JSON.parse(cleaned);
      const validated = schema.parse(parsed); // throws ZodError if invalid

      // ── SUCCESS ──────────────────────────────────────────────────────────
      const stageEnd    = performance.now();
      const usageMeta   = { inputTokens: accInputTok, outputTokens: accOutputTok };
      const stageMetric = metrics.recordStage(stageName, stageStart, stageEnd, usageMeta, repairsUsed);

      compilationHistory.push({
        event:      "STAGE_COMPLETE",
        stageName,
        repairsUsed,
        latencyMs:  stageMetric.latencyMs,
        costUSD:    stageMetric.stageCostUSD,
        timestamp:  new Date().toISOString(),
      });

      return { parsed: validated, usageMeta };

    } catch (err) {

      // ── Fast-fail on non-recoverable API errors (429, 401, 403, 404, 5xx) ──
      // Self-repair only makes sense for Zod/JSON parse failures, NOT for
      // quota exhaustion, auth failures, or missing models.  Retrying those
      // wastes quota and makes things worse.
      if (isNonRecoverableApiError(err)) {
        const stageEnd  = performance.now();
        const usageMeta = { inputTokens: accInputTok, outputTokens: accOutputTok };
        metrics.recordStage(stageName, stageStart, stageEnd, usageMeta, repairsUsed);

        compilationHistory.push({
          event:      "STAGE_FAILED_API_ERROR",
          stageName,
          repairsUsed,
          httpStatus: err.status,
          finalError: String(err),
          timestamp:  new Date().toISOString(),
        });

        const failErr     = new Error(`Stage "${stageName}" failed with non-recoverable API error (HTTP ${err.status}).`);
        failErr.stageName = stageName;
        failErr.cause     = err;
        failErr.rawOutput = lastRawText;
        throw failErr;
      }

      lastError = err;

      // If max repairs exhausted — surface structured failure
      if (attempt === MAX_REPAIRS) {
        const stageEnd   = performance.now();
        const usageMeta  = { inputTokens: accInputTok, outputTokens: accOutputTok };
        metrics.recordStage(stageName, stageStart, stageEnd, usageMeta, repairsUsed);

        compilationHistory.push({
          event:      "STAGE_FAILED",
          stageName,
          repairsUsed,
          finalError: String(err),
          timestamp:  new Date().toISOString(),
        });

        const failErr     = new Error(`Stage "${stageName}" failed after ${MAX_REPAIRS} repair attempts.`);
        failErr.stageName = stageName;
        failErr.cause     = err;
        failErr.rawOutput = lastRawText;
        throw failErr;
      }
      // else: loop continues to next repair attempt
    }
  }
}

/**
 * runCompilationPipeline
 *
 * Sequential async execution chain — output of Stage N is immutable
 * context injected into Stage N+1.
 *
 * @param {string} userPrompt - Natural-language system description
 * @returns {object} Full compilation result
 */
async function runCompilationPipeline(userPrompt) {
  const metrics            = new MetricsLogger();
  const compilationHistory = [];

  compilationHistory.push({
    event:     "PIPELINE_START",
    timestamp: new Date().toISOString(),
    input:     userPrompt.slice(0, 300),
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  STAGE 1 — INTENT EXTRACTION
  // ══════════════════════════════════════════════════════════════════════════
  const stage1Prompt = `
Extract the software system intent from the following description.

OUTPUT SCHEMA (produce exactly this shape):
{
  "entities": [
    { "name": "string", "description": "string", "attributes": ["string"] }
  ],
  "userRoles": [
    { "role": "string", "description": "string", "permissions": ["string"] }
  ],
  "coreFeatures": [
    {
      "featureName": "string",
      "description": "string",
      "involvedEntities": ["string"],
      "requiredRoles": ["string"]
    }
  ]
}

USER SYSTEM DESCRIPTION:
${userPrompt}
  `.trim();

  const { parsed: intentResult } = await runStage({
    stageName:         "Stage1_IntentExtraction",
    systemInstruction: COMPILER_SYSTEM_BASE,
    userPrompt:        stage1Prompt,
    schema:            IntentExtractionSchema,
    metrics,
    compilationHistory,
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  STAGE 2 — SYSTEM DESIGN
  //  Context: Stage 1 validated output (immutable)
  // ══════════════════════════════════════════════════════════════════════════
  const stage2Prompt = `
Design the full system architecture based on the extracted intent below.

STAGE 1 CONTEXT (immutable — do not alter):
${JSON.stringify(intentResult)}

OUTPUT SCHEMA (produce exactly this shape):
{
  "entities": [
    { "name": "string", "fields": ["string"], "primaryKey": "string" }
  ],
  "relationships": [
    {
      "from": "string",
      "to": "string",
      "type": "one-to-one|one-to-many|many-to-many",
      "description": "string"
    }
  ],
  "systemRoles": [
    { "role": "string", "level": 0, "scopes": ["string"] }
  ],
  "accessMatrix": {
    "<entityName>": {
      "<roleName>": ["create","read","update","delete"]
    }
  }
}

Rules:
- Every entity from Stage 1 must appear.
- Every user role from Stage 1 must appear as a systemRole.
- Access matrix must cover every entity × role combination.
  `.trim();

  const { parsed: designResult } = await runStage({
    stageName:         "Stage2_SystemDesign",
    systemInstruction: COMPILER_SYSTEM_BASE,
    userPrompt:        stage2Prompt,
    schema:            SystemDesignSchema,
    metrics,
    compilationHistory,
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  STAGE 3 — SCHEMA GENERATION
  //  Context: Stage 1 + Stage 2 validated outputs (immutable)
  // ══════════════════════════════════════════════════════════════════════════
  const stage3Prompt = `
Generate four synchronized schemas: UI, API, DB, and Auth.

STAGE 1 CONTEXT (immutable):
${JSON.stringify(intentResult)}

STAGE 2 CONTEXT (immutable):
${JSON.stringify(designResult)}

OUTPUT SCHEMA (produce exactly this shape):
{
  "uiSchema": {
    "layout": {
      "appName": "string",
      "navLinks": ["string"],
      "pages": [
        {
          "path": "/path",
          "name": "string",
          "isGated": true,
          "gatedRoles": ["string"],
          "components": [
            {
              "componentName": "string",
              "fields": ["string"],
              "bindsToEntity": "string"
            }
          ]
        }
      ]
    },
    "pages": [ /* same array as layout.pages */ ]
  },
  "apiSchema": {
    "basePath": "/api/v1",
    "routes": [
      {
        "path": "/resource",
        "method": "GET|POST|PUT|PATCH|DELETE",
        "auth": true,
        "roles": ["string"],
        "requestPayload":  { "fieldName": "type" },
        "responsePayload": { "fieldName": "type" },
        "entity": "string"
      }
    ]
  },
  "dbSchema": {
    "dialect": "postgresql",
    "tables": [
      {
        "tableName": "string",
        "entity": "string",
        "columns": [
          {
            "name": "string",
            "type": "string",
            "nullable": false,
            "unique": false,
            "default": "string"
          }
        ],
        "foreignKeys": [
          {
            "column": "string",
            "referencesTable": "string",
            "referencesColumn": "string"
          }
        ]
      }
    ]
  },
  "authSchema": {
    "strategy": "JWT",
    "rolePermissions": [
      {
        "role": "string",
        "allowedRoutes": ["/api/v1/path"],
        "deniedRoutes": [],
        "tokenExpiry": "24h"
      }
    ]
  }
}

CRITICAL ALIGNMENT RULES — treat these as compiler constraints:
1. Every UI component field must appear in at least one API route's requestPayload or responsePayload for the same entity.
2. Every API route requestPayload/responsePayload field must map to a DB column for that entity (except meta fields: id, token, accessToken, refreshToken, page, limit, totalCount, message, success).
3. Every page where isGated=true must have its path listed in at least one rolePermission's allowedRoutes.
4. uiSchema.layout.pages and uiSchema.pages must contain IDENTICAL arrays.
  `.trim();

  const { parsed: schemaResult } = await runStage({
    stageName:         "Stage3_SchemaGeneration",
    systemInstruction: COMPILER_SYSTEM_BASE,
    userPrompt:        stage3Prompt,
    schema:            SchemaGenerationSchema,
    metrics,
    compilationHistory,
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  CROSS-LAYER CONSISTENCY VALIDATION
  //  (programmatic — independent of the model)
  // ══════════════════════════════════════════════════════════════════════════
  compilationHistory.push({
    event:     "CROSS_LAYER_VALIDATION_START",
    timestamp: new Date().toISOString(),
  });

  let schemaResultValidated = schemaResult;

  // Wrap cross-layer validation inside the self-repair loop
  for (let repairAttempt = 0; repairAttempt <= MAX_REPAIRS; repairAttempt++) {
    try {
      validateCrossLayerConsistency(schemaResultValidated);

      compilationHistory.push({
        event:     "CROSS_LAYER_VALIDATION_PASSED",
        timestamp: new Date().toISOString(),
      });
      break; // ✓ Clean — exit repair loop

    } catch (clErr) {
      if (!(clErr instanceof CrossLayerValidationError)) throw clErr;

      if (repairAttempt === MAX_REPAIRS) {
        compilationHistory.push({
          event:      "CROSS_LAYER_VALIDATION_FAILED_UNRECOVERABLE",
          mismatches: clErr.mismatches,
          timestamp:  new Date().toISOString(),
        });
        throw clErr;
      }

      // Surgical repair prompt for cross-layer mismatch
      metrics.recordRepair("Stage3_CrossLayerRepair", repairAttempt + 1, "CROSS_LAYER_MISMATCH",
        JSON.stringify(clErr.toJSON()).slice(0, 400));

      compilationHistory.push({
        event:          "CROSS_LAYER_REPAIR_ATTEMPT",
        attempt:        repairAttempt + 1,
        mismatches:     clErr.mismatches,
        timestamp:      new Date().toISOString(),
      });

      const clRepairPrompt = `
You are a DETERMINISTIC COMPILER repairing a cross-layer schema consistency failure.

CROSS-LAYER VALIDATION ERROR REPORT (fix exactly these mismatches — nothing else):
${JSON.stringify(clErr.toJSON(), null, 2)}

CURRENT SCHEMAS (mutate only the broken fields):
${JSON.stringify(schemaResultValidated)}

RULES FOR REPAIR:
- Rule UI_FIELD_MISSING_IN_API: Add the missing field to the correct API route's requestPayload or responsePayload.
- Rule API_PAYLOAD_FIELD_MISSING_IN_DB: Add a column to the relevant DB table.
- Rule GATED_UI_ROUTE_MISSING_AUTH_PERMISSION: Add the page path to allowedRoutes of the relevant role in authSchema.rolePermissions.
- Do NOT change anything unrelated to the listed mismatches.
- Return the COMPLETE corrected schemaGeneration JSON (same shape, repaired mutations).
      `.trim();

      const { text: repairText, inputTokens, outputTokens } = await callGemini(COMPILER_SYSTEM_BASE, clRepairPrompt);
      metrics.stages[metrics.stages.length - 1] &&
        (metrics.totalInputTokens  += inputTokens,
         metrics.totalOutputTokens += outputTokens);

      const repairParsed    = JSON.parse(stripToJSON(repairText));
      schemaResultValidated = SchemaGenerationSchema.parse(repairParsed);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  STAGE 4 — FINAL REFINED PACKAGE
  //  Context: All prior validated outputs (immutable)
  // ══════════════════════════════════════════════════════════════════════════
  const stage4Prompt = `
Produce the final cross-layer synchronized package with verified schemas
and explicitly documented system assumptions.

STAGE 1 CONTEXT (immutable): ${JSON.stringify(intentResult)}
STAGE 2 CONTEXT (immutable): ${JSON.stringify(designResult)}
STAGE 3 CONTEXT (immutable): ${JSON.stringify(schemaResultValidated)}

OUTPUT SCHEMA (produce exactly this shape):
{
  "ui": {
    "appName": "string",
    "navLinks": ["string"],
    "pages": [ /* UIPage objects */ ]
  },
  "api": {
    "basePath": "/api/v1",
    "routes": [ /* APIRoute objects */ ]
  },
  "db": {
    "dialect": "string",
    "tables": [ /* DBTable objects */ ]
  },
  "auth": {
    "strategy": "string",
    "rolePermissions": [ /* AuthRolePermission objects */ ]
  },
  "systemAssumptions": [
    {
      "id": "ASSUMPTION_001",
      "assumption": "string",
      "rationale": "string",
      "affectedLayers": ["ui","api","db","auth"]
    }
  ]
}

Rules:
- ui, api, db, auth must be taken verbatim from Stage 3 (no regression).
- systemAssumptions must contain at least 3 entries documenting key design decisions.
- Every assumption must specify which layers it affects.
  `.trim();

  const { parsed: finalResult } = await runStage({
    stageName:         "Stage4_FinalRefinedPackage",
    systemInstruction: COMPILER_SYSTEM_BASE,
    userPrompt:        stage4Prompt,
    schema:            FinalRefinedSchema,
    metrics,
    compilationHistory,
  });

  compilationHistory.push({
    event:     "PIPELINE_COMPLETE",
    timestamp: new Date().toISOString(),
  });

  return {
    success:            true,
    finalSchemas:       finalResult,
    stageOutputs: {
      intentExtraction: intentResult,
      systemDesign:     designResult,
      schemaGeneration: schemaResultValidated,
    },
    compilationHistory,
    telemetry: metrics.summarize(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPRESS APP
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
app.set("json spaces", 2);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.static("public"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status:    "ok",
    model:     MODEL_ID,
    timestamp: new Date().toISOString(),
    version:   "1.0.0",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/compile
//  Body: { "prompt": "<natural-language system description>" }
// ─────────────────────────────────────────────────────────────────────────────

// Request body validator
const CompileRequestSchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters."),
});

app.post("/api/compile", async (req, res) => {
  // ── Validate request body ─────────────────────────────────────────────────
  const bodyParse = CompileRequestSchema.safeParse(req.body);
  if (!bodyParse.success) {
    return res.status(400).json({
      success: false,
      error:   "INVALID_REQUEST",
      details: bodyParse.error.errors,
    });
  }

  const { prompt } = bodyParse.data;

  if (!GEMINI_KEY) {
    return res.status(500).json({
      success: false,
      error:   "GEMINI_API_KEY environment variable is not set.",
    });
  }

  // ── Execute the pipeline ──────────────────────────────────────────────────
  try {
    console.log(`[PIPELINE] Starting compilation for prompt: "${prompt.slice(0, 80)}..."`);
    const result = await runCompilationPipeline(prompt);
    console.log(`[PIPELINE] Complete — latency: ${result.telemetry.totalPipelineLatencyMs}ms | cost: $${result.telemetry.totalCostUSD}`);
    return res.status(200).json(result);

  } catch (err) {
    console.error("[PIPELINE] Fatal error:", err);

    // CrossLayerValidationError — still return structured body
    if (err instanceof CrossLayerValidationError) {
      return res.status(422).json({
        success:    false,
        error:      "CROSS_LAYER_VALIDATION_FAILURE",
        details:    err.toJSON(),
        autoRepair: "exhausted",
      });
    }

    // Stage failure with structured cause
    if (err.stageName) {
      const cause      = err.cause;
      const httpStatus = cause?.status === 429 ? 429
                       : cause?.status === 401 ? 401
                       : cause?.status === 403 ? 403
                       : 500;

      // 429 gets a human-friendly explanation + resolution hints
      if (cause?.status === 429) {
        return res.status(429).json({
          success:    false,
          error:      "QUOTA_EXHAUSTED",
          stageName:  err.stageName,
          message:    "Your Gemini API free-tier quota is exhausted for today or this minute.",
          resolution: [
            "Wait for the rate-limit window to reset (the API suggests ~42 seconds for per-minute limits).",
            "Enable billing on your Google Cloud / AI Studio project at https://aistudio.google.com/.",
            "Check your quota dashboard at https://ai.dev/rate-limit.",
            "Use a different API key that has remaining quota.",
          ],
          retryAfterSeconds: 60,
          rawApiError: String(cause).slice(0, 400),
        });
      }

      return res.status(httpStatus).json({
        success:    false,
        error:      "STAGE_FAILURE",
        stageName:  err.stageName,
        message:    err.message,
        cause:      cause instanceof z.ZodError
                      ? { type: "ZOD_VALIDATION", issues: cause.errors }
                      : { type: "API_ERROR", httpStatus: cause?.status, message: String(cause).slice(0, 400) },
        rawOutput:  err.rawOutput ? err.rawOutput.slice(0, 500) : null,
      });
    }

    // Generic fallback
    return res.status(500).json({
      success: false,
      error:   "INTERNAL_ERROR",
      message: err.message || String(err),
    });
  }
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "NOT_FOUND" });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[UNHANDLED]", err);
  res.status(500).json({
    success: false,
    error:   "UNHANDLED_SERVER_ERROR",
    message: err.message,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   SOFTWARE GENERATION COMPILER PIPELINE — SERVER READY      ║");
  console.log(`║   Listening on http://localhost:${PORT}                          ║`);
  console.log(`║   Model: ${MODEL_ID}              ║`);
  console.log(`║   Max repairs per stage: ${MAX_REPAIRS}                               ║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");
});

module.exports = app;
