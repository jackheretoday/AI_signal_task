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
const yaml       = require("js-yaml");
const crypto     = require("crypto");

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const PORT        = process.env.PORT || 3000;
const GEMINI_KEY  = process.env.GEMINI_API_KEY || "";
const GEMINI_KEY_2 = process.env.BACKUP_API_KEY || "";
let activeApiKey  = GEMINI_KEY;
const MODEL_ID    = process.env.MODEL_ID || "gemini-2.5-flash"; // Configurable via environment, fallback to 2.5 Flash
const MAX_REPAIRS = 3; // Maximum surgical self-repair attempts per stage
let latestOpenApiSpec = null; // In-memory cache for downloaded OpenAPI spec

// Approximate cost table (USD per 1 million tokens)
const COST_TABLE = {
  inputTokensPerMillion:  0.15, // Gemini 2.5 Flash input
  outputTokensPerMillion: 0.60, // Gemini 2.5 Flash output
};

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE GENAI CLIENT
// ─────────────────────────────────────────────────────────────────────────────
let genai = new GoogleGenAI({ apiKey: activeApiKey });

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

// ── Stage 5: Quality Scoring ──────────────────────────────────────────────────
const QualityScoreFindingSchema = z.object({
  dimension: z.string(),
  issue: z.string(),
  deduction: z.number(),
  recommendation: z.string()
});

const QualityScoreSchema = z.object({
  scores: z.object({
    security: z.number().min(0).max(100),
    scalability: z.number().min(0).max(100),
    maintainability: z.number().min(0).max(100),
    reliability: z.number().min(0).max(100),
    compliance: z.number().min(0).max(100)
  }),
  overallScore: z.number().min(0).max(100),
  findings: z.array(QualityScoreFindingSchema)
});

// ── Stage 6: AI Advisor ───────────────────────────────────────────────────────
const RecommendationSchema = z.object({
  trigger: z.string(),
  pattern: z.string(),
  rationale: z.string(),
  implementation: z.string()
});

const ArchitectAdvisorSchema = z.object({
  recommendations: z.array(RecommendationSchema)
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
// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS: Rate Limit and Transient Error Classifiers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classifies if an error represents a rate limit / quota exhaustion.
 */
function isRateLimitError(status, msg) {
  return (status === 429) ||
    (typeof status === "string" && status === "RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("resource exhausted") ||
    msg.includes("exhausted");
}

/**
 * Classifies if an error is transient (rate limits, 5xx, or other temporary outages).
 */
function isTransientError(status, msg) {
  return isRateLimitError(status, msg) ||
    (typeof status === "number" && (status >= 500 && status < 600)) ||
    (typeof status === "string" && ["INTERNAL", "UNAVAILABLE"].includes(status)) ||
    msg.includes("temporary") ||
    msg.includes("unavailable");
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
  const isNvidia = activeApiKey.startsWith("nvapi-") || activeApiKey.startsWith("AQ.Ab");

  if (isNvidia) {
    let modelToUse = MODEL_ID;
    // Fallback to a valid NVIDIA model if the configured model is a Google/Gemini model
    if (modelToUse.startsWith("gemini-")) {
      modelToUse = "nvidia/llama-3.3-nemotron-super-49b-v1.5";
    } else if (modelToUse === "Llama-3.3-Nemotron-Super-49b-v1.5" || modelToUse.toLowerCase() === "llama-3.3-nemotron-super-49b-v1.5") {
      modelToUse = "nvidia/llama-3.3-nemotron-super-49b-v1.5";
    }

    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${activeApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt }
          ],
          temperature: 0,
          top_p: 1
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(`NVIDIA API error: ${response.status} ${response.statusText} - ${errorText}`);
        err.status = response.status;
        throw err;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      const usage = data.usage || {};
      const inputTokens = usage.prompt_tokens || estimateTokens(userPrompt + systemInstruction);
      const outputTokens = usage.completion_tokens || estimateTokens(text);

      return { text, inputTokens, outputTokens };
    } catch (err) {
      const status = err.status ?? err.statusCode ?? err.code;
      const msg = String(err.message || err).toLowerCase();

      if (isRateLimitError(status, msg) && activeApiKey !== GEMINI_KEY_2 && GEMINI_KEY_2) {
        console.warn(
          `\n🚨 [NVIDIA API KEY EXHAUSTED] Rate limit or quota hit on primary key (status: ${status || "unknown"}). \n` +
          `Switching to backup API key: ${GEMINI_KEY_2.slice(0, 8)}...\n`
        );
        activeApiKey = GEMINI_KEY_2;
        genai = new GoogleGenAI({ apiKey: activeApiKey });
        return callGemini(systemInstruction, userPrompt, 3, delayMs);
      }

      if (isTransientError(status, msg) && retriesLeft > 0) {
        console.warn(
          `\n⚠️ [NVIDIA API] Transient error (status: ${status || "unknown"}). \n` +
          `Retrying in ${delayMs}ms... (${retriesLeft} retries left). \n` +
          `Reason: ${err.message || err}\n`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return callGemini(systemInstruction, userPrompt, retriesLeft - 1, delayMs * 2);
      }
      throw err;
    }
  }

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
    
    if (isRateLimitError(status, msg) && activeApiKey !== GEMINI_KEY_2 && GEMINI_KEY_2) {
      console.warn(
        `\n🚨 [GEMINI API KEY EXHAUSTED] Rate limit or quota hit on primary key (status: ${status || "unknown"}). \n` +
        `Switching to backup API key: ${GEMINI_KEY_2.slice(0, 8)}...\n`
      );
      activeApiKey = GEMINI_KEY_2;
      genai = new GoogleGenAI({ apiKey: activeApiKey });
      return callGemini(systemInstruction, userPrompt, 3, delayMs);
    }

    if (isTransientError(status, msg) && retriesLeft > 0) {
      console.warn(
        `\n⚠️ [GEMINI API] Transient error (status: ${status || "unknown"}). \n` +
        `Retrying in ${delayMs}ms... (${retriesLeft} retries left). 
` +
        `Reason: ${err.message || err}\n`
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return callGemini(systemInstruction, userPrompt, retriesLeft - 1, delayMs * 2);
    }
    
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

function mapPropertyType(fieldName) {
  const lower = fieldName.toLowerCase();
  if (fieldName.endsWith("_id") || fieldName.endsWith("Id")) {
    return { type: "string", format: "uuid" };
  }
  if (["amount", "rate", "price", "count"].includes(lower)) {
    return { type: "number" };
  }
  if (fieldName.startsWith("is_") || fieldName.startsWith("has_") || fieldName.startsWith("can_") ||
      fieldName.startsWith("is") || fieldName.startsWith("has") || fieldName.startsWith("can")) {
    if (fieldName.startsWith("is_") || fieldName.startsWith("has_") || fieldName.startsWith("can_") ||
        (fieldName.startsWith("is") && fieldName[2] === fieldName[2]?.toUpperCase()) ||
        (fieldName.startsWith("has") && fieldName[3] === fieldName[3]?.toUpperCase()) ||
        (fieldName.startsWith("can") && fieldName[3] === fieldName[3]?.toUpperCase())) {
      return { type: "boolean" };
    }
  }
  if (fieldName === "created_at" || fieldName === "updated_at" || fieldName === "createdAt" || fieldName === "updatedAt") {
    return { type: "string", format: "date-time" };
  }
  return { type: "string" };
}

function generateOpenApiSpec(apiSchema, appName) {
  const routes = apiSchema?.routes || apiSchema?.endpoints || [];
  const basePath = apiSchema?.basePath || "";

  const openApiDoc = {
    openapi: "3.1.0",
    info: {
      title: appName || "API Specification",
      version: "1.0.0",
      description: `Auto-generated OpenAPI 3.1.0 specification for ${appName || "the application"}.`
    },
    servers: [
      {
        url: basePath ? basePath : "/api/v1"
      }
    ],
    paths: {},
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    }
  };

  routes.forEach(route => {
    let path = route.path || "/";
    if (basePath && path.startsWith(basePath)) {
      path = path.slice(basePath.length);
    }
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    const method = (route.method || "GET").toLowerCase();
    
    if (!openApiDoc.paths[path]) {
      openApiDoc.paths[path] = {};
    }

    const roles = route.roles || [];
    const hasAuth = route.auth || roles.length > 0;

    const op = {
      summary: route.description || `${route.method || "GET"} ${route.entity || "resource"}`,
      security: hasAuth ? [{ BearerAuth: [] }] : [],
      responses: {
        "200": {
          description: "Success",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {}
              }
            }
          }
        },
        "401": {
          description: "Unauthorized"
        },
        "422": {
          description: "Validation Error"
        }
      }
    };

    const resPayload = route.responsePayload || {};
    const resProps = {};
    Object.keys(resPayload).forEach(prop => {
      resProps[prop] = mapPropertyType(prop);
    });
    op.responses["200"].content["application/json"].schema.properties = resProps;

    if (["post", "put", "patch"].includes(method)) {
      const payload = route.requestPayload || route.payload || {};
      const reqProps = {};
      Object.keys(payload).forEach(prop => {
        reqProps[prop] = mapPropertyType(prop);
      });

      op.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: reqProps
            }
          }
        }
      };
    }

    openApiDoc.paths[path][method] = op;
  });

  return yaml.dump(openApiDoc);
}

function generateC4ContextSvg(finalSchemas, appName) {
  const W = 900;
  const H = 600;
  
  // 1. Persons Extraction
  const rolesSet = new Set();
  const rolePermissions = finalSchemas.auth?.rolePermissions || finalSchemas.authSchema?.rolePermissions || [];
  rolePermissions.forEach(rp => {
    if (rp.role) rolesSet.add(rp.role.trim());
  });
  
  if (rolesSet.size === 0) {
    const systemRoles = finalSchemas.systemRoles || [];
    systemRoles.forEach(r => {
      if (r.role) rolesSet.add(r.role.trim());
    });
  }
  
  if (rolesSet.size === 0) {
    const pages = finalSchemas.ui?.pages || finalSchemas.uiSchema?.pages || [];
    pages.forEach(p => {
      if (p.gatedRoles) {
        p.gatedRoles.forEach(r => rolesSet.add(r.trim()));
      }
    });
  }
  
  if (rolesSet.size === 0) {
    rolesSet.add("User");
  }
  
  const sortedRoles = Array.from(rolesSet).sort();
  const maxVisiblePersons = 5;
  const visibleRoles = sortedRoles.slice(0, maxVisiblePersons);
  const extraPersonsCount = sortedRoles.length - visibleRoles.length;
  
  // 2. External Systems Extraction
  const externalSystemsSet = new Set();
  const nameMapping = {
    "stripe": "Stripe",
    "payment": "Payment Processor",
    "email": "Email Provider",
    "smtp": "SMTP Server",
    "s3": "Amazon S3",
    "storage": "Cloud Storage",
    "google": "Google API",
    "twilio": "Twilio",
    "sms": "SMS Gateway",
    "push": "Push Service",
    "firebase": "Firebase",
    "sendgrid": "SendGrid"
  };
  
  const assumptions = finalSchemas.systemAssumptions || [];
  const keywords = Object.keys(nameMapping);
  assumptions.forEach(asm => {
    const text = ((asm.assumption || "") + " " + (asm.rationale || "")).toLowerCase();
    keywords.forEach(kw => {
      if (text.includes(kw)) {
        externalSystemsSet.add(nameMapping[kw]);
      }
    });
  });
  
  const routes = finalSchemas.api?.routes || finalSchemas.apiSchema?.routes || [];
  routes.forEach(route => {
    const path = (route.path || "").toLowerCase();
    if (path.includes("webhook") || path.includes("callback")) {
      const match = route.path.match(/(?:webhooks|webhook|callback)\/([^/]+)/i);
      if (match && match[1]) {
        let cleanName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        if (nameMapping[cleanName.toLowerCase()]) {
          cleanName = nameMapping[cleanName.toLowerCase()];
        }
        externalSystemsSet.add(cleanName);
      } else {
        externalSystemsSet.add("External System");
      }
    }
  });
  
  const strategy = (finalSchemas.auth?.strategy || finalSchemas.authSchema?.strategy || "").toLowerCase();
  if (strategy.includes("oauth") || strategy.includes("sso")) {
    externalSystemsSet.add("Auth Provider");
  }
  
  const sortedExternals = Array.from(externalSystemsSet).sort();
  const maxVisibleExternals = 6;
  const visibleExternals = sortedExternals.slice(0, maxVisibleExternals);
  const extraExternalsCount = sortedExternals.length - visibleExternals.length;
  
  // 3. Render System Description
  let systemDesc = "Core application system";
  if (finalSchemas.description) {
    systemDesc = finalSchemas.description;
  } else if (assumptions.length > 0) {
    const mainAsm = assumptions.find(a => (a.assumption || "").toLowerCase().includes("platform") || (a.assumption || "").toLowerCase().includes("architecture"));
    if (mainAsm) {
      systemDesc = mainAsm.assumption;
    }
  }
  if (systemDesc.length > 80) {
    systemDesc = systemDesc.slice(0, 77) + "...";
  }
  
  // Helper to wrap text
  function wrapText(text, maxChars) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";
    words.forEach(word => {
      if ((currentLine + " " + word).trim().length <= maxChars) {
        currentLine = (currentLine + " " + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);
    return lines;
  }
  
  const descLines = wrapText(systemDesc, 36).slice(0, 2);
  
  // Start SVG string
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" style="background:#f4f6f9;">\n`;
  svg += `  <defs>\n`;
  svg += `    <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n`;
  svg += `      <path d="M 0 0 L 10 5 L 0 10 z" fill="#333" />\n`;
  svg += `    </marker>\n`;
  svg += `    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">\n`;
  svg += `      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.1"/>\n`;
  svg += `    </filter>\n`;
  svg += `  </defs>\n`;
  
  // ── PERSONS ROW Spacing (Top) ──
  const finalPersonsList = [...visibleRoles];
  if (extraPersonsCount > 0) {
    finalPersonsList.push(`+${extraPersonsCount} More`);
  }
  
  const pCount = finalPersonsList.length;
  const spacingP = W / (pCount + 1);
  const personCoords = [];
  
  finalPersonsList.forEach((role, i) => {
    const px = spacingP * (i + 1) - 80;
    const py = 60;
    const isExtra = role.startsWith("+");
    
    personCoords.push({ x: px + 80, y: py + 80, isExtra });
    
    // Box
    svg += `  <!-- Person Box: ${role} -->\n`;
    svg += `  <rect x="${px}" y="${py}" width="160" height="80" rx="8" ry="8" fill="#EEF2FF" stroke="#534AB7" stroke-width="1.5" filter="url(#shadow)" />\n`;
    
    if (isExtra) {
      svg += `  <text x="${px + 80}" y="${py + 38}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#534AB7" text-anchor="middle">${role} Roles</text>\n`;
      svg += `  <text x="${px + 80}" y="${py + 54}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-style="italic" fill="#666" text-anchor="middle">Roles</text>\n`;
    } else {
      // Stick figure
      svg += `  <circle cx="${px + 25}" cy="${py + 28}" r="7" fill="none" stroke="#534AB7" stroke-width="2"/>\n`;
      svg += `  <line x1="${px + 25}" y1="${py + 35}" x2="${px + 25}" y2="${py + 55}" stroke="#534AB7" stroke-width="2"/>\n`;
      svg += `  <line x1="${px + 17}" y1="${py + 42}" x2="${px + 33}" y2="${py + 42}" stroke="#534AB7" stroke-width="2"/>\n`;
      svg += `  <line x1="${px + 25}" y1="${py + 55}" x2="${px + 18}" y2="${py + 68}" stroke="#534AB7" stroke-width="2"/>\n`;
      svg += `  <line x1="${px + 25}" y1="${py + 55}" x2="${px + 32}" y2="${py + 68}" stroke="#534AB7" stroke-width="2"/>\n`;
      
      // Text
      let displayRole = role;
      if (role.length > 13) {
        displayRole = role.slice(0, 11) + "...";
      }
      svg += `  <text x="${px + 45}" y="${py + 38}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#1a1a1a">${displayRole}</text>\n`;
      svg += `  <text x="${px + 45}" y="${py + 54}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-style="italic" fill="#666">User</text>\n`;
    }
  });
  
  // ── YOUR SYSTEM (Center) ──
  const sx = 310;
  const sy = 240;
  const sw = 280;
  const sh = 120;
  
  svg += `  <!-- Your System Box -->\n`;
  svg += `  <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="4" ry="4" fill="#ffffff" stroke="#111111" stroke-width="2.5" filter="url(#shadow)" />\n`;
  
  // App Name Truncation
  const displayAppName = appName.length > 20 ? appName.slice(0, 17) + "..." : appName;
  svg += `  <text x="${sx + sw/2}" y="${sy + 32}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#111" text-anchor="middle">${displayAppName}</text>\n`;
  svg += `  <text x="${sx + sw/2}" y="${sy + 52}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#E05A00" letter-spacing="0.1em" text-anchor="middle">&lt;&lt;SOFTWARE SYSTEM&gt;&gt;</text>\n`;
  
  // Description Lines
  descLines.forEach((line, idx) => {
    svg += `  <text x="${sx + sw/2}" y="${sy + 80 + idx * 16}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#555" text-anchor="middle">${line}</text>\n`;
  });
  
  // ── EXTERNAL SYSTEMS ROW Spacing (Bottom) ──
  const finalExternalsList = [...visibleExternals];
  if (extraExternalsCount > 0) {
    finalExternalsList.push(`+${extraExternalsCount} More`);
  }
  
  const eCoords = [];
  
  if (finalExternalsList.length === 0) {
    // Note box
    const nX = 360;
    const nY = 460;
    const nW = 180;
    const nH = 60;
    svg += `  <!-- Note box -->\n`;
    svg += `  <rect x="${nX}" y="${nY}" width="${nW}" height="${nH}" rx="6" ry="6" fill="#FFFBEB" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="3 3" />\n`;
    svg += `  <text x="${nX + nW/2}" y="${nY + 35}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#B45309" text-anchor="middle" font-weight="700">No external integrations detected</text>\n`;
  } else {
    const eCount = finalExternalsList.length;
    const spacingE = W / (eCount + 1);
    
    finalExternalsList.forEach((name, j) => {
      const ex = spacingE * (j + 1) - 90;
      const ey = 460;
      const isExtra = name.startsWith("+");
      
      eCoords.push({ x: ex + 90, y: ey, isExtra, name });
      
      svg += `  <!-- External System Box: ${name} -->\n`;
      if (isExtra) {
        svg += `  <rect x="${ex}" y="${ey}" width="180" height="80" rx="8" ry="8" fill="#F9FAFB" stroke="#888888" stroke-width="1.5" stroke-dasharray="3 3" filter="url(#shadow)" />\n`;
        svg += `  <text x="${ex + 90}" y="${ey + 38}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#666" text-anchor="middle">${name} Systems</text>\n`;
        svg += `  <text x="${ex + 90}" y="${ey + 54}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-style="italic" fill="#888" text-anchor="middle">Systems</text>\n`;
      } else {
        svg += `  <rect x="${ex}" y="${ey}" width="180" height="80" rx="8" ry="8" fill="#F9FAFB" stroke="#888888" stroke-width="1.5" stroke-dasharray="4 4" filter="url(#shadow)" />\n`;
        
        let displayName = name;
        if (name.length > 18) {
          displayName = name.slice(0, 16) + "...";
        }
        svg += `  <text x="${ex + 90}" y="${ey + 38}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#333" text-anchor="middle">${displayName}</text>\n`;
        svg += `  <text x="${ex + 90}" y="${ey + 54}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-style="italic" fill="#666" text-anchor="middle">&lt;&lt;External System&gt;&gt;</text>\n`;
      }
    });
  }
  
  // ── CONNECTORS: PERSONS → SYSTEM ──
  personCoords.forEach(coord => {
    if (coord.isExtra) return;
    
    const targetX = Math.max(340, Math.min(560, coord.x));
    const targetY = 240;
    
    // Draw direct line with arrow
    svg += `  <line x1="${coord.x}" y1="140" x2="${targetX}" y2="${targetY}" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)" />\n`;
    
    // Midpoint label
    const mx = (coord.x + targetX) / 2;
    const my = (140 + targetY) / 2;
    svg += `  <rect x="${mx - 24}" y="${my - 8}" width="48" height="16" fill="#f4f6f9" rx="3" />\n`;
    svg += `  <text x="${mx}" y="${my + 4}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-style="italic" fill="#888" text-anchor="middle">Uses</text>\n`;
  });
  
  // ── CONNECTORS: SYSTEM → EXTERNAL SYSTEMS ──
  function getConnectorLabel(name) {
    const lower = name.toLowerCase();
    if (lower.includes("stripe") || lower.includes("payment")) return "Processes payments via";
    if (lower.includes("email") || lower.includes("smtp") || lower.includes("sendgrid")) return "Sends emails via";
    if (lower.includes("s3") || lower.includes("storage")) return "Stores files in";
    if (lower.includes("auth") || lower.includes("provider")) return "Authenticates via";
    return "Integrates with";
  }
  
  eCoords.forEach(coord => {
    if (coord.isExtra) return;
    
    const sourceX = Math.max(340, Math.min(560, coord.x));
    const sourceY = 360;
    
    svg += `  <line x1="${sourceX}" y1="${sourceY}" x2="${coord.x}" y2="460" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)" />\n`;
    
    // Label midpoint
    const mx = (sourceX + coord.x) / 2;
    const my = (sourceY + 460) / 2;
    const label = getConnectorLabel(coord.name);
    
    const textWidth = Math.max(60, label.length * 5.2);
    svg += `  <rect x="${mx - textWidth/2}" y="${my - 8}" width="${textWidth}" height="16" fill="#f4f6f9" rx="3" />\n`;
    svg += `  <text x="${mx}" y="${my + 4}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-style="italic" fill="#888" text-anchor="middle">${label}</text>\n`;
  });
  
  // ── LEGEND (Bottom-Left Corner) ──
  const legY = H - 90;
  svg += `  <!-- Legend -->\n`;
  svg += `  <rect x="14" y="${legY}" width="180" height="76" rx="4" ry="4" fill="#ffffff" stroke="#dddddd" stroke-width="1" />\n`;
  svg += `  <text x="24" y="${legY + 16}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#666">LEGEND</text>\n`;
  
  // Legend items
  svg += `  <rect x="24" y="${legY + 24}" width="12" height="12" rx="2" fill="#EEF2FF" stroke="#534AB7" stroke-width="1" />\n`;
  svg += `  <text x="42" y="${legY + 34}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" fill="#333">Internal User</text>\n`;
  
  svg += `  <rect x="24" y="${legY + 40}" width="12" height="12" rx="1" fill="#ffffff" stroke="#111111" stroke-width="1.5" />\n`;
  svg += `  <text x="42" y="${legY + 50}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" fill="#333">This System</text>\n`;
  
  svg += `  <rect x="24" y="${legY + 56}" width="12" height="12" rx="2" fill="#F9FAFB" stroke="#888888" stroke-width="1" stroke-dasharray="2 2" />\n`;
  svg += `  <text x="42" y="${legY + 66}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" fill="#333">External System</text>\n`;
  
  svg += `</svg>`;
  
  return svg;
}

function generateERDSvg(dbSchema) {
  const tables = dbSchema?.tables || [];
  if (tables.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="10" y="50" fill="#999">No Database Tables</text></svg>`;
  }

  const tableCoords = new Map();
  const numCols = 3;
  const colSpacing = 240;
  const tableWidth = 200;
  const headerHeight = 36;
  const colRowHeight = 28;

  // 1. Calculate row heights first
  const rowHeights = [];
  const numRows = Math.ceil(tables.length / numCols);
  for (let r = 0; r < numRows; r++) {
    const startIdx = r * numCols;
    const rowTables = tables.slice(startIdx, startIdx + numCols);
    let tallestInRow = 0;
    rowTables.forEach(t => {
      const h = headerHeight + t.columns.length * colRowHeight;
      if (h > tallestInRow) tallestInRow = h;
    });
    rowHeights.push(tallestInRow);
  }

  // 2. Map tables to coordinates
  tables.forEach((t, idx) => {
    const r = Math.floor(idx / numCols);
    const c = idx % numCols;
    const x = c * colSpacing + 30;
    
    // y is sum of previous row heights + vertical gap (50px per gap) + 30px padding
    let y = 30;
    for (let prevR = 0; prevR < r; prevR++) {
      y += rowHeights[prevR] + 50;
    }
    
    const h = headerHeight + t.columns.length * colRowHeight;
    tableCoords.set(t.tableName, {
      x,
      y,
      width: tableWidth,
      height: h,
      table: t
    });
  });

  // Calculate total dimensions
  const totalWidth = (Math.min(tables.length, numCols) * colSpacing) + 60;
  let totalHeight = 30;
  rowHeights.forEach((h, r) => {
    totalHeight += h;
    if (r < rowHeights.length - 1) {
      totalHeight += 50;
    }
  });
  totalHeight += 30; // bottom padding

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" style="background:#0b0f19;">\n`;
  svgContent += `  <style>\n`;
  svgContent += `    .table-title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; fill: #ffffff; }\n`;
  svgContent += `    .col-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; fill: #333333; }\n`;
  svgContent += `    .col-type { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 10px; fill: #666666; }\n`;
  svgContent += `    .badge-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 9px; font-weight: 700; fill: #ffffff; text-anchor: middle; }\n`;
  svgContent += `  </style>\n`;

  // 3. Draw foreign key connections first so they render under the tables
  tables.forEach(table => {
    const coords = tableCoords.get(table.tableName);
    if (!coords || !table.foreignKeys) return;

    table.foreignKeys.forEach(fk => {
      const targetCoords = tableCoords.get(fk.referencesTable);
      if (!targetCoords) {
        console.warn(`[ERD] Target table not found: ${fk.referencesTable}`);
        return;
      }

      const srcColIdx = table.columns.findIndex(c => c.name === fk.column);
      const targetColIdx = targetCoords.table.columns.findIndex(c => c.name === fk.referencesColumn);

      if (srcColIdx === -1) return;

      const isSelf = table.tableName === fk.referencesTable;

      const srcX = coords.x + tableWidth;
      const srcY = coords.y + headerHeight + (srcColIdx * colRowHeight) + (colRowHeight / 2);

      // For self-referencing FK, target is on the right side. Otherwise target is on the left side of referenced table.
      const tgtX = isSelf ? (coords.x + tableWidth) : targetCoords.x;
      const tgtY = targetCoords.y + headerHeight + (Math.max(0, targetColIdx) * colRowHeight) + (colRowHeight / 2);

      // SVG path: M source_x source_y L (source_x + 20) source_y L (source_x + 20) target_y L target_x target_y
      const pathD = `M ${srcX} ${srcY} L ${srcX + 20} ${srcY} L ${srcX + 20} ${tgtY} L ${tgtX} ${tgtY}`;

      svgContent += `  <!-- Connection: ${table.tableName}.${fk.column} -> ${fk.referencesTable}.${fk.referencesColumn} -->\n`;
      svgContent += `  <path d="${pathD}" fill="none" stroke="#E05A00" stroke-width="1.5" stroke-dasharray="4 2" />\n`;
      svgContent += `  <circle cx="${tgtX}" cy="${tgtY}" r="4" fill="#E05A00" />\n`;
    });
  });

  // 4. Draw tables on top
  tables.forEach(table => {
    const coords = tableCoords.get(table.tableName);
    if (!coords) return;

    const { x, y, width, height } = coords;

    svgContent += `  <!-- Table: ${table.tableName} -->\n`;
    // Table container background and rounded border
    svgContent += `  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" ry="6" fill="#ffffff" stroke="#cccccc" stroke-width="1.5" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.1));" />\n`;
    
    // Header background (#111) with rounded top corners
    svgContent += `  <path d="M ${x} ${y + 6} A 6 6 0 0 1 ${x + 6} ${y} H ${x + width - 6} A 6 6 0 0 1 ${x + width} ${y + 6} V ${y + headerHeight} H ${x} Z" fill="#111111" />\n`;
    
    // Table Name
    svgContent += `  <text x="${x + 12}" y="${y + 22}" class="table-title">${table.tableName}</text>\n`;
    
    // Column rows
    table.columns.forEach((col, idx) => {
      const rowY = y + headerHeight + (idx * colRowHeight);
      const isAlt = idx % 2 === 1;
      const rowBg = isAlt ? "#f9f9f9" : "#ffffff";

      // Row background
      svgContent += `  <rect x="${x + 1}" y="${rowY}" width="${width - 2}" height="${colRowHeight}" fill="${rowBg}" />\n`;

      // Determine icons
      const isPK = idx === 0; // First column is PK
      const isFK = table.foreignKeys && table.foreignKeys.some(fk => fk.column === col.name);
      
      let icon = "🔹";
      if (isPK) icon = "🔑";
      else if (isFK) icon = "🔗";

      // Draw Icon and Name
      svgContent += `  <text x="${x + 10}" y="${rowY + 17}" class="col-text">${icon} ${col.name}</text>\n`;

      // Draw Type
      const typeStr = col.type.toLowerCase();
      svgContent += `  <text x="${x + 105}" y="${rowY + 17}" class="col-type">${typeStr}</text>\n`;

      // Draw Badges
      let badgeX = x + 185;
      if (isPK) {
        svgContent += `  <rect x="${badgeX - 16}" y="${rowY + 7}" width="18" height="14" rx="3" fill="#2E7D32" />\n`;
        svgContent += `  <text x="${badgeX - 7}" y="${rowY + 17}" class="badge-text">PK</text>\n`;
      } else if (isFK) {
        svgContent += `  <rect x="${badgeX - 16}" y="${rowY + 7}" width="18" height="14" rx="3" fill="#E05A00" />\n`;
        svgContent += `  <text x="${badgeX - 7}" y="${rowY + 17}" class="badge-text">FK</text>\n`;
      } else if (!col.nullable) {
        svgContent += `  <rect x="${badgeX - 16}" y="${rowY + 7}" width="18" height="14" rx="3" fill="#555555" />\n`;
        svgContent += `  <text x="${badgeX - 7}" y="${rowY + 17}" class="badge-text">NN</text>\n`;
      }

      // Add thin line separator between rows
      if (idx < table.columns.length - 1) {
        svgContent += `  <line x1="${x + 1}" y1="${rowY + colRowHeight}" x2="${x + width - 1}" y2="${rowY + colRowHeight}" stroke="#eeeeee" stroke-width="1" />\n`;
      }
    });

    // Draw bottom border under header to separate from columns
    svgContent += `  <line x1="${x}" y1="${y + headerHeight}" x2="${x + width}" y2="${y + headerHeight}" stroke="#111111" stroke-width="1" />\n`;
  });

  svgContent += "</svg>";
  return svgContent;
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

  // ══════════════════════════════════════════════════════════════════════════
  //  STAGE 5 — ARCHITECTURE QUALITY SCORING ENGINE
  //  Context: Stage 4 validated finalSchemas (immutable)
  // ══════════════════════════════════════════════════════════════════════════
  const stage5Prompt = `
You are a DETERMINISTIC COMPILER MODULE representing the Architecture Quality Scoring Engine.
Analyze the complete architectural package defined in Stage 4 context below.

STAGE 4 CONTEXT (immutable):
${JSON.stringify(finalResult)}

TASK:
Evaluate the system design and calculate quality scores (0-100) for five specific dimensions using these exact deduction rules based strictly on the schemas:

1. Security (0-100):
   - Deduct 10 per API endpoint missing a role in its "roles" array.
   - Deduct 15 if "tokenExpiry" is not defined or is missing in the authSchema rolePermissions.
   - Deduct 5 per UI route that is gated ("isGated": true) but has no matching allowedRoute in authSchema.rolePermissions.

2. Scalability (0-100):
   - Deduct 10 per list/GET endpoint missing pagination parameters ("page", "limit", "offset", etc.) in requestPayload.
   - Deduct 15 if no caching strategy is explicitly mentioned in systemAssumptions.
   - Deduct 10 if there are no database indexes defined (e.g. unique constraints or indexes).

3. Maintainability (0-100):
   - Deduct 5 per database table missing a clear description or purpose in its fields/schema.
   - Deduct 10 if API routes lack versioning prefixes (e.g. no "/v1/" or "/v1" in route paths).
   - Deduct 8 per system assumption that is marked unresolved or ambiguous.

4. Reliability (0-100):
   - Deduct 15 if no webhook retry logic is mentioned or defined in the apiSchema/assumptions.
   - Deduct 10 if no soft delete column ("deleted_at", "deletedAt") is present on any database table.
   - Deduct 10 if no error response schemas are explicitly documented on endpoints.

5. Compliance (0-100):
   - Deduct 20 if EU/GDPR-related entities (like users, customer profiles, payment accounts) exist but no data export / delete endpoint exists in apiSchema.
   - Deduct 15 if user PII fields exist without an explicit encryption attribute.

Scoring Formula:
overallScore = Weighted average:
  security * 0.25 + scalability * 0.20 + maintainability * 0.20 + reliability * 0.20 + compliance * 0.15

OUTPUT SCHEMA:
Produce a single minified JSON object matching this schema:
{
  "scores": {
    "security": number,
    "scalability": number,
    "maintainability": number,
    "reliability": number,
    "compliance": number
  },
  "overallScore": number,
  "findings": [
    {
      "dimension": "Security|Scalability|Maintainability|Reliability|Compliance",
      "issue": "string description of what you detected",
      "deduction": number,
      "recommendation": "string action item"
    }
  ]
}
  `.trim();

  const { parsed: qualityScoreResult } = await runStage({
    stageName:         "Stage5_QualityScoring",
    systemInstruction: COMPILER_SYSTEM_BASE,
    userPrompt:        stage5Prompt,
    schema:            QualityScoreSchema,
    metrics,
    compilationHistory,
  });

  // Calculate unique fingerprint
  const compilationFingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify(finalResult))
    .digest("hex")
    .slice(0, 12);

  // ══════════════════════════════════════════════════════════════════════════
  //  STAGE 6 — AI ARCHITECTURE ADVISOR
  //  Context: finalSchemas + qualityScoreResult (immutable)
  // ══════════════════════════════════════════════════════════════════════════
  const stage6Prompt = `
You are a principal software architect with 20 years experience.
Review the following final schemas, quality scores, and findings:

FINAL SCHEMAS:
${JSON.stringify(finalResult)}

QUALITY SCORES & FINDINGS:
${JSON.stringify(qualityScoreResult)}

TASK:
Provide exactly 4 architectural recommendations. Each recommendation must reference a specific pattern, standard, or technology based strictly on your observations of the schemas.

OUTPUT SCHEMA:
Produce a single minified JSON object matching this schema:
{
  "recommendations": [
    {
      "trigger": "string describing what you detected in the schema",
      "pattern": "architectural pattern, standard, or technology name",
      "rationale": "why this pattern applies to resolve the trigger",
      "implementation": "one concrete, actionable implementation step"
    }
  ]
}
  `.trim();

  const { parsed: architectAdvisorResult } = await runStage({
    stageName:         "Stage6_AIArchitectureAdvisor",
    systemInstruction: COMPILER_SYSTEM_BASE,
    userPrompt:        stage6Prompt,
    schema:            ArchitectAdvisorSchema,
    metrics,
    compilationHistory,
  });

  // Generate and cache OpenAPI YAML spec
  const openApiSpec = generateOpenApiSpec(finalResult.api || finalResult.apiSchema, finalResult.ui?.appName || "SaaS Platform");
  latestOpenApiSpec = openApiSpec;

  // Generate ERD SVG from the DB schema
  const erdSvg = generateERDSvg(finalResult.db || finalResult.dbSchema);

  // Generate C4 Context SVG
  const c4ContextSvg = generateC4ContextSvg(finalResult, finalResult.ui?.appName || "SaaS Platform");

  compilationHistory.push({
    event:     "PIPELINE_COMPLETE",
    timestamp: new Date().toISOString(),
  });

  return {
    success:            true,
    finalSchemas:       finalResult,
    qualityScore:       qualityScoreResult,
    architectAdvisor:   architectAdvisorResult,
    openApiSpec:        openApiSpec,
    compilationFingerprint: compilationFingerprint,
    erdSvg:             erdSvg,
    c4ContextSvg:       c4ContextSvg,
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

// Debug endpoint to check current API key switching status
app.get("/api/debug-key-switch", (req, res) => {
  const primaryMasked = GEMINI_KEY ? `${GEMINI_KEY.slice(0, 8)}...${GEMINI_KEY.slice(-4)}` : "not set";
  const backupMasked = GEMINI_KEY_2 ? `${GEMINI_KEY_2.slice(0, 8)}...${GEMINI_KEY_2.slice(-4)}` : "not set";
  const activeMasked = activeApiKey ? `${activeApiKey.slice(0, 8)}...${activeApiKey.slice(-4)}` : "not set";

  res.status(200).json({
    success: true,
    primaryKey: primaryMasked,
    backupKey: backupMasked,
    activeKey: activeMasked,
    usingBackup: activeApiKey === GEMINI_KEY_2,
    nvidiaDetectedForActive: activeApiKey.startsWith("nvapi-") || activeApiKey.startsWith("AQ.Ab"),
  });
});

// Simulated endpoint to trigger rate-limiting fallback test
app.post("/api/simulate-rate-limit", (req, res) => {
  try {
    console.log("[DEBUG] Simulating a rate limit error to test key switcher...");
    const mockError = new Error("Resource exhausted (rate limit simulated).");
    mockError.status = 429;
    mockError.code = "RESOURCE_EXHAUSTED";

    const status = mockError.status;
    const msg = String(mockError.message).toLowerCase();

    if (isRateLimitError(status, msg) && activeApiKey !== GEMINI_KEY_2 && GEMINI_KEY_2) {
      console.warn(
        `\n🚨 [SIMULATED KEY EXHAUSTED] Rate limit or quota hit on primary key. \n` +
        `Switching to backup API key: ${GEMINI_KEY_2.slice(0, 8)}...\n`
      );
      activeApiKey = GEMINI_KEY_2;
      genai = new GoogleGenAI({ apiKey: activeApiKey });
      return res.status(200).json({
        success: true,
        message: "Simulated rate limit successfully triggered API key fallback!",
        activeKey: `${activeApiKey.slice(0, 8)}...${activeApiKey.slice(-4)}`
      });
    }

    return res.status(400).json({
      success: false,
      message: "No switcher action performed. Perhaps you are already on the backup key or backup key is not configured.",
      activeKey: activeApiKey ? `${activeApiKey.slice(0, 8)}...${activeApiKey.slice(-4)}` : "not set"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

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

// ── OpenAPI Export ────────────────────────────────────────────────────────────
app.get("/api/export/openapi", (req, res) => {
  if (!latestOpenApiSpec) {
    return res.status(400).json({
      success: false,
      error: "No compilation found. Run a pipeline first."
    });
  }

  res.setHeader("Content-Type", "application/x-yaml");
  res.setHeader("Content-Disposition", 'attachment; filename="openapi.yaml"');
  res.send(latestOpenApiSpec);
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
  console.log("║               ARCHFORGEX COMPILER — SERVER READY       ║");
  console.log(`║   Listening on http://localhost:${PORT}                          ║`);
  console.log(`║   Model: ${MODEL_ID}              ║`);
  console.log(`║   Max repairs per stage: ${MAX_REPAIRS}                               ║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");
});

module.exports = app;
