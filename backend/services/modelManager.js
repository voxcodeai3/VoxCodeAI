/**
 * VoxCode Model Manager — multi-model pool with failover and 1-hour sleep.
 *
 * Reads model configuration from numbered env vars:
 *   AI_MODEL_N_PROVIDER, AI_MODEL_N_NAME, AI_MODEL_N_API_KEY,
 *   AI_MODEL_N_BASE_URL, AI_MODEL_N_PRIORITY   (N = 1, 2, 3, …)
 *
 * Falls back to legacy single-model vars when no numbered vars exist:
 *   AI_PROVIDER, AI_MODEL, AI_API_KEY, AI_BASE_URL
 *
 * Runtime state (sleep timers, errors) is persisted to disk so rate-limited
 * models stay asleep across server restarts.
 */

const fs = require("fs");
const path = require("path");

const SLEEP_DURATION_MS = 60 * 60 * 1000; // 1 hour
const STATE_FILE = path.join(__dirname, "..", "model-state.json");

/* ── Normalized error categories ───────────────────────────────────────── */

const ERROR_CATEGORIES = {
  RATE_LIMITED: "RATE_LIMITED",
  TIMEOUT: "TIMEOUT",
  UNAVAILABLE: "UNAVAILABLE",
  SERVER_ERROR: "SERVER_ERROR",
  AUTH_ERROR: "AUTH_ERROR",
  INVALID_REQUEST: "INVALID_REQUEST",
  UNKNOWN: "UNKNOWN",
};

/* ── Env var parsing ────────────────────────────────────────────────────── */

function parseNumberedModels() {
  const models = [];
  for (let i = 1; i <= 20; i++) {
    const provider = (process.env[`AI_MODEL_${i}_PROVIDER`] || "").trim();
    const name = (process.env[`AI_MODEL_${i}_NAME`] || "").trim();
    const apiKey = (process.env[`AI_MODEL_${i}_API_KEY`] || "").trim();
    const baseUrl = (process.env[`AI_MODEL_${i}_BASE_URL`] || "").trim();
    const priority = parseInt(process.env[`AI_MODEL_${i}_PRIORITY`], 10) || i;

    if (!apiKey) continue; // skip unconfigured slots

    models.push({
      id: `model-${i}`,
      provider: provider || null,
      name: name || null,
      apiKey,
      baseUrl: baseUrl || null,
      priority,
    });
  }
  return models;
}

function parseLegacyModel() {
  const provider = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  const name = (process.env.AI_MODEL || "").trim();
  const apiKey = (process.env.AI_API_KEY || "").trim();
  const baseUrl = (process.env.AI_BASE_URL || "").trim();

  if (!apiKey) return null;

  return {
    id: "model-legacy",
    provider: provider || null,
    name: name || null,
    apiKey,
    baseUrl: baseUrl || null,
    priority: 1,
  };
}

/* ── Model Manager class ────────────────────────────────────────────────── */

class ModelManager {
  constructor() {
    /** @type {Map<string, object>} id → runtime model state */
    this.models = new Map();
    this.initialized = false;
  }

  /**
   * Load configuration from env vars and merge any persisted sleep state.
   * Safe to call multiple times (idempotent after first init).
   */
  init() {
    if (this.initialized) return;

    let configs = parseNumberedModels();
    if (!configs.length) {
      const legacy = parseLegacyModel();
      if (legacy) configs = [legacy];
    }

    // Load persisted state (sleep timers survive restarts).
    const persisted = this._loadState();

    for (const cfg of configs) {
      const saved = persisted[cfg.id];
      this.models.set(cfg.id, {
        ...cfg,
        status: "AVAILABLE",
        sleepStartedAt: saved?.sleepStartedAt || null,
        sleepUntil: saved?.sleepUntil || null,
        lastError: saved?.lastError || null,
        lastUsedAt: null,
        consecutiveFailures: 0,
      });
    }

    // Restore sleeping models whose wake time hasn't passed yet.
    const now = Date.now();
    for (const [, m] of this.models) {
      if (m.sleepUntil && m.sleepUntil > now) {
        m.status = "SLEEPING";
      } else if (m.sleepUntil && m.sleepUntil <= now) {
        // Wake time already passed on restart — wake immediately.
        m.sleepUntil = null;
        m.sleepStartedAt = null;
        m.status = "AVAILABLE";
      }
    }

    this.initialized = true;
    const count = this.models.size;
    if (count) {
      console.log(`[ModelManager] Loaded ${count} model(s).`);
    } else {
      console.log("[ModelManager] No AI models configured.");
    }
  }

  /** Number of configured models. */
  get size() {
    return this.models.size;
  }

  /**
   * Select the highest-priority AVAILABLE model.
   * Returns null when no model is available.
   */
  select() {
    this._wakeExpiredModels();

    let best = null;
    for (const [, m] of this.models) {
      if (m.status !== "AVAILABLE") continue;
      if (!best || m.priority < best.priority) best = m;
    }

    if (best) {
      best.status = "IN_USE";
      best.lastUsedAt = Date.now();
    }

    return best;
  }

  /**
   * Return a model to AVAILABLE after a successful response.
   * @param {string} modelId
   */
  release(modelId) {
    const m = this.models.get(modelId);
    if (!m) return;
    if (m.status === "IN_USE") {
      m.status = "AVAILABLE";
      m.consecutiveFailures = 0;
    }
    this._saveState();
  }

  /**
   * Mark a model as rate-limited and put it to sleep for 1 hour.
   * @param {string} modelId
   * @param {string} reason
   */
  markRateLimited(modelId, reason = "RATE_LIMITED") {
    const m = this.models.get(modelId);
    if (!m) return;

    const now = Date.now();
    m.status = "SLEEPING";
    m.sleepStartedAt = now;
    m.sleepUntil = now + SLEEP_DURATION_MS;
    m.lastError = reason;
    m.consecutiveFailures += 1;

    const wakeTime = new Date(m.sleepUntil).toISOString();
    console.log(`[AI] ${m.id} (${m.provider}/${m.name}) rate limited. Sleeping until ${wakeTime}.`);

    this._saveState();
  }

  /**
   * Mark a model as unavailable (auth error, invalid config, etc.).
   * It stays in the pool but is never selected.
   * @param {string} modelId
   * @param {string} reason
   */
  markUnavailable(modelId, reason = "UNAVAILABLE") {
    const m = this.models.get(modelId);
    if (!m) return;

    m.status = "UNAVAILABLE";
    m.lastError = reason;
    m.consecutiveFailures += 1;

    console.log(`[AI] ${m.id} marked unavailable: ${reason}.`);

    this._saveState();
  }

  /**
   * Mark a model as temporarily errored — it stays AVAILABLE for retry
   * on the next request (unless it hits the rate-limit threshold).
   * @param {string} modelId
   * @param {string} reason
   */
  markError(modelId, reason = "UNKNOWN") {
    const m = this.models.get(modelId);
    if (!m) return;

    m.lastError = reason;
    m.consecutiveFailures += 1;

    // If it keeps failing, put it to sleep.
    if (m.consecutiveFailures >= 3) {
      this.markRateLimited(modelId, reason);
      return;
    }

    // Return to available so the next request can try a different model
    // (the failover loop in aiService will try the next one anyway).
    if (m.status === "IN_USE") m.status = "AVAILABLE";

    this._saveState();
  }

  /**
   * Check whether a sleeping model is now available.
   * Performs a lightweight health check.
   * @param {string} modelId
   * @returns {Promise<boolean>} true if the model is available again
   */
  async healthCheck(modelId) {
    const m = this.models.get(modelId);
    if (!m) return false;

    console.log(`[AI] ${m.id} wake-up health check started.`);

    try {
      await this._probe(m);
      m.status = "AVAILABLE";
      m.sleepStartedAt = null;
      m.sleepUntil = null;
      m.lastError = null;
      m.consecutiveFailures = 0;
      console.log(`[AI] ${m.id} available. Returned to active pool.`);
      this._saveState();
      return true;
    } catch (err) {
      const category = categorizeError(err);
      if (category === ERROR_CATEGORIES.RATE_LIMITED) {
        // Sleep another hour.
        const now = Date.now();
        m.sleepStartedAt = now;
        m.sleepUntil = now + SLEEP_DURATION_MS;
        m.lastError = "RATE_LIMITED";
        const wakeTime = new Date(m.sleepUntil).toISOString();
        console.log(`[AI] ${m.id} still rate limited. Sleeping until ${wakeTime}.`);
      } else {
        // Non-rate-limit error — mark unavailable temporarily.
        m.status = "UNAVAILABLE";
        m.lastError = category;
        console.log(`[AI] ${m.id} health check failed: ${category}. Marked unavailable.`);
      }
      this._saveState();
      return false;
    }
  }

  /** Snapshot of all model statuses (no secrets). */
  getStatus() {
    this._wakeExpiredModels();
    const snapshot = [];
    for (const [, m] of this.models) {
      snapshot.push({
        id: m.id,
        provider: m.provider,
        name: m.name,
        priority: m.priority,
        status: m.status,
        lastError: m.lastError,
        sleepUntil: m.sleepUntil ? new Date(m.sleepUntil).toISOString() : null,
      });
    }
    return snapshot.sort((a, b) => a.priority - b.priority);
  }

  /* ── Internal helpers ─────────────────────────────────────────────────── */

  /** Wake any sleeping models whose sleep period has elapsed. */
  _wakeExpiredModels() {
    const now = Date.now();
    for (const [, m] of this.models) {
      if (m.status !== "SLEEPING") continue;
      if (!m.sleepUntil) {
        m.status = "AVAILABLE";
        continue;
      }
      if (m.sleepUntil <= now) {
        // Sleep period expired — wake the model back to active pool.
        m.sleepUntil = null;
        m.sleepStartedAt = null;
        m.status = "AVAILABLE";
      }
    }
  }

  /** Lightweight probe — makes a minimal request to verify the model responds. */
  async _probe(m) {
    const timeout = 12000;
    const baseUrl = m.baseUrl || "https://api.openai.com/v1";
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${m.apiKey}`,
        },
        body: JSON.stringify({
          model: m.name || "gpt-4o-mini",
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    } finally {
      clearTimeout(timer);
    }
  }

  /* ── Persistence ──────────────────────────────────────────────────────── */

  _saveState() {
    const state = {};
    for (const [id, m] of this.models) {
      state[id] = {
        sleepStartedAt: m.sleepStartedAt,
        sleepUntil: m.sleepUntil,
        lastError: m.lastError,
      };
    }
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
    } catch {
      /* non-fatal */
    }
  }

  _loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      }
    } catch {
      /* corrupted or missing — start fresh */
    }
    return {};
  }
}

/* ── Error categorization (provider-neutral) ────────────────────────────── */

function categorizeError(err) {
  const msg = (err?.message || "").toLowerCase();
  const status = err?.status || err?.statusCode || 0;

  // HTTP 429 — universal rate limit.
  if (status === 429 || msg.includes("429")) return ERROR_CATEGORIES.RATE_LIMITED;

  // Common rate-limit phrases across providers.
  const rateLimitPhrases = [
    "rate limit",
    "rate_limit",
    "ratelimit",
    "quota exceeded",
    "usage limit",
    "too many requests",
    "requests per",
    "tokens per",
    "credits have been exhausted",
    "billing",
    "limit reached",
    "throttl",
  ];
  if (rateLimitPhrases.some((p) => msg.includes(p))) return ERROR_CATEGORIES.RATE_LIMITED;

  // Timeout / abort.
  if (msg.includes("abort") || msg.includes("timeout") || msg.includes("timed out"))
    return ERROR_CATEGORIES.TIMEOUT;

  // Server errors (5xx).
  if (status >= 500 || msg.includes("500") || msg.includes("502") || msg.includes("503"))
    return ERROR_CATEGORIES.SERVER_ERROR;

  // Auth errors.
  if (
    status === 401 ||
    status === 403 ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("invalid api key") ||
    msg.includes("authentication")
  )
    return ERROR_CATEGORIES.AUTH_ERROR;

  // Bad request.
  if (status === 400 || msg.includes("invalid_request") || msg.includes("bad request"))
    return ERROR_CATEGORIES.INVALID_REQUEST;

  // Unavailable / network.
  if (
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("network") ||
    msg.includes("unavailable")
  )
    return ERROR_CATEGORIES.UNAVAILABLE;

  return ERROR_CATEGORIES.UNKNOWN;
}

/** Check if a category is retryable (safe to failover to another model). */
function isRetryable(category) {
  return (
    category === ERROR_CATEGORIES.RATE_LIMITED ||
    category === ERROR_CATEGORIES.TIMEOUT ||
    category === ERROR_CATEGORIES.UNAVAILABLE ||
    category === ERROR_CATEGORIES.SERVER_ERROR
  );
}

/** Singleton instance shared across the application. */
const modelManager = new ModelManager();

module.exports = {
  modelManager,
  ModelManager,
  ERROR_CATEGORIES,
  categorizeError,
  isRetryable,
  SLEEP_DURATION_MS,
};
