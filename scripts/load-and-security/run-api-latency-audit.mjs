#!/usr/bin/env node
/**
 * Auditoria de latência por endpoint HTTP (latência observada do cliente).
 *
 * Inspirado em fluxos de “API latency map” / smoke com percentis; para carga pesada use `autocannon` (npm run load:test).
 *
 * Uso:
 *   npm run audit:api-latency
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:3000 LATENCY_AUDIT_ITERATIONS=50 npm run audit:api-latency
 *   LOAD_TEST_COOKIE='next-auth.session-token=...' npm run audit:api-latency
 *   Com cookie, POST /auth/context usa `tenantId` de GET /me ou LOAD_TEST_AUTH_CONTEXT_TENANT_ID.
 *
 * Com cookie — bloco **pesado** (Kanban, dashboard SLA, clientes com filtro status=scan, detalhe/timeline):
 *   Descobre `pathwayId` (com versão publicada), `stageId`, `clientId`, `patientPathwayId` via API.
 *   Opcional: LOAD_TEST_PATHWAY_ID, LOAD_TEST_STAGE_ID, LOAD_TEST_CLIENT_ID, LOAD_TEST_PATIENT_PATHWAY_ID
 *   Desligar: LATENCY_AUDIT_SKIP_HEAVY=1
 *
 * Carga / limite do servidor:
 *   LATENCY_AUDIT_ITERATIONS   — rodadas por endpoint (default 50)
 *   LATENCY_AUDIT_CONCURRENCY — req paralelas por rodada (default 20 → 50×20 ≈ 1000 timings/endpoint)
 *   LATENCY_AUDIT_WARMUP      — rodadas de aquecimento (default 6)
 *   Ou: npm run audit:api-latency:stress (presets ainda mais agressivos)
 *
 * Rate limit (Redis): API autenticada ≈ 120 req/min por usuário (`src/lib/api/rate-limit.ts`).
 *   Se quase tudo vira 429, use smoke: LATENCY_AUDIT_CONCURRENCY=1 LATENCY_AUDIT_ITERATIONS=12
 *   Medição sem RL na API autenticada (só dev): coloque LOAD_TEST_DISABLE_API_RL=1 no .env.local
 *   e **reinicie o Next** (a flag vale no servidor, não neste script Node).
 *
 * Endpoints extras (JSON no disco):
 *   LATENCY_AUDIT_ENDPOINTS_FILE=./my-endpoints.json
 *
 * Formato do JSON: array de { "name": "opcional", "method": "GET", "path": "/api/v1/...", "body"?: object, "headers"?: {} }
 *
 * No servidor, queries lentas no Postgres: use `pg_stat_statements` ou o script `npm run audit:prisma-queries`.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getBaseUrl } from "./lib/base-url.mjs";

const base = getBaseUrl();
const iterations = Math.max(3, Number(process.env.LATENCY_AUDIT_ITERATIONS ?? 50));
const warmup = Math.max(0, Number(process.env.LATENCY_AUDIT_WARMUP ?? 6));
/** Requisições em paralelo por rodada (explora fila do Node/DB e rate limit). */
const concurrency = Math.max(1, Math.min(150, Number(process.env.LATENCY_AUDIT_CONCURRENCY ?? 20)));
const timeoutMs = Math.max(1000, Number(process.env.LATENCY_AUDIT_TIMEOUT_MS ?? 180_000));
const cookie = process.env.LOAD_TEST_COOKIE?.trim();
const endpointsFile = process.env.LATENCY_AUDIT_ENDPOINTS_FILE?.trim();

/** @returns {{ name?: string, method: string, path: string, body?: unknown, headers?: Record<string, string> }[]} */
function getPublicEndpoints() {
  return [
    { name: "health + DB ping", method: "GET", path: "/api/v1/health" },
    { name: "/me (401 sem cookie)", method: "GET", path: "/api/v1/me" },
    { name: "/clients (401 sem cookie)", method: "GET", path: "/api/v1/clients" },
    { name: "/pathways (401 sem cookie)", method: "GET", path: "/api/v1/pathways" },
    { name: "/patient-pathways (401 sem cookie)", method: "GET", path: "/api/v1/patient-pathways" },
    { name: "/opme-suppliers (401 sem cookie)", method: "GET", path: "/api/v1/opme-suppliers" },
    { name: "/notifications (401 sem cookie)", method: "GET", path: "/api/v1/notifications" },
    { name: "/reports/summary (401 sem cookie)", method: "GET", path: "/api/v1/reports/summary" },
    { name: "/tenant (401 sem cookie)", method: "GET", path: "/api/v1/tenant" },
    { name: "/admin/tenants (401 sem cookie)", method: "GET", path: "/api/v1/admin/tenants" },
    { name: "auth/context POST (401 sem cookie)", method: "POST", path: "/api/v1/auth/context", body: {} },
  ];
}

async function fetchMeTenantId() {
  if (!cookie) return null;
  const path = "/api/v1/me";
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", Cookie: cookie },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const tid = json?.data?.user?.tenantId;
    return typeof tid === "string" && tid.length > 0 ? tid : null;
  } catch {
    return null;
  }
}

/** @param {string} pathQuery path + query, ex. /api/v1/clients?limit=1 */
async function authGetJson(pathQuery) {
  const url = `${base}${pathQuery.startsWith("/") ? pathQuery : `/${pathQuery}`}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", Cookie: cookie },
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return { res, json };
}

/**
 * IDs para rotas dinâmicas (Kanban, cliente, jornada). Usa env ou descobre com poucos GETs.
 * @returns {Promise<{ pathwayId: string|null, stageId: string|null, clientId: string|null, patientPathwayId: string|null }>}
 */
async function discoverHeavyContext() {
  /** @type {{ pathwayId: string|null, stageId: string|null, clientId: string|null, patientPathwayId: string|null }} */
  const ctx = {
    pathwayId: process.env.LOAD_TEST_PATHWAY_ID?.trim() || null,
    stageId: process.env.LOAD_TEST_STAGE_ID?.trim() || null,
    clientId: process.env.LOAD_TEST_CLIENT_ID?.trim() || null,
    patientPathwayId: process.env.LOAD_TEST_PATIENT_PATHWAY_ID?.trim() || null,
  };

  const { res: pr, json: pj } = await authGetJson("/api/v1/pathways");
  if (!ctx.pathwayId && pr.ok) {
    const list = pj?.data?.pathways ?? [];
    const published = list.find((p) => p.publishedVersion);
    ctx.pathwayId = published?.id ?? list[0]?.id ?? null;
  }

  if (ctx.pathwayId && !ctx.stageId) {
    const { res, json } = await authGetJson(`/api/v1/pathways/${ctx.pathwayId}/published-stages`);
    if (res.ok) {
      const stages = json?.data?.version?.stages ?? [];
      ctx.stageId = stages[0]?.id ?? null;
    }
  }

  if (!ctx.clientId) {
    const { res, json } = await authGetJson("/api/v1/clients?limit=1&page=1");
    if (res.ok) {
      ctx.clientId = json?.data?.data?.[0]?.id ?? null;
    }
  }

  if (!ctx.patientPathwayId) {
    const { res, json } = await authGetJson("/api/v1/patient-pathways");
    if (res.ok) {
      ctx.patientPathwayId = json?.data?.patientPathways?.[0]?.id ?? null;
    }
  }

  return ctx;
}

/**
 * Rotas que exercitam agregações Kanban, scan de SLA em listagem de clientes, timelines, etc.
 * @param {{ pathwayId: string|null, stageId: string|null, clientId: string|null, patientPathwayId: string|null }} h
 */
function buildHeavyEndpoints(h) {
  /** @type {{ name: string, method: string, path: string, body?: unknown }[]} */
  const list = [
    {
      name: "HEAVY GET /clients limit=100",
      method: "GET",
      path: "/api/v1/clients?limit=100&page=1",
    },
    {
      name: "HEAVY GET /clients limit=100 page=2",
      method: "GET",
      path: "/api/v1/clients?limit=100&page=2",
    },
    {
      name: "HEAVY GET /clients status=ok (scan batches)",
      method: "GET",
      path: "/api/v1/clients?limit=50&page=1&status=ok",
    },
    {
      name: "HEAVY GET /clients status=warning (scan batches)",
      method: "GET",
      path: "/api/v1/clients?limit=50&page=1&status=warning",
    },
    {
      name: "HEAVY GET /clients status=danger (scan batches)",
      method: "GET",
      path: "/api/v1/clients?limit=50&page=1&status=danger",
    },
    {
      name: "HEAVY GET /clients status=completed (scan batches)",
      method: "GET",
      path: "/api/v1/clients?limit=50&page=1&status=completed",
    },
    {
      name: "HEAVY GET /tenant/members",
      method: "GET",
      path: "/api/v1/tenant/members",
    },
  ];

  if (h.pathwayId) {
    list.push(
      {
        name: "HEAVY GET /pathways/…/kanban limit=100",
        method: "GET",
        path: `/api/v1/pathways/${h.pathwayId}/kanban?limit=100`,
      },
      {
        name: "HEAVY GET /pathways/…/dashboard-summary (até 5k PP)",
        method: "GET",
        path: `/api/v1/pathways/${h.pathwayId}/dashboard-summary`,
      },
      {
        name: "HEAVY GET /pathways/…/dashboard-alerts limit=100",
        method: "GET",
        path: `/api/v1/pathways/${h.pathwayId}/dashboard-alerts?limit=100`,
      },
      {
        name: "HEAVY GET /pathways/…/published-stages",
        method: "GET",
        path: `/api/v1/pathways/${h.pathwayId}/published-stages`,
      },
    );
  }

  if (h.pathwayId && h.stageId) {
    list.push(
      {
        name: "HEAVY GET /pathways/…/kanban/columns/…/patients p=1 lim=100",
        method: "GET",
        path: `/api/v1/pathways/${h.pathwayId}/kanban/columns/${h.stageId}/patients?limit=100&page=1`,
      },
      {
        name: "HEAVY GET /pathways/…/kanban/columns/…/patients p=2 lim=100",
        method: "GET",
        path: `/api/v1/pathways/${h.pathwayId}/kanban/columns/${h.stageId}/patients?limit=100&page=2`,
      },
    );
  }

  if (h.clientId) {
    list.push(
      {
        name: "HEAVY GET /client detail transitions limit=50",
        method: "GET",
        path: `/api/v1/clients/${h.clientId}?page=1&limit=50`,
      },
      {
        name: "HEAVY GET /client timeline limit=50",
        method: "GET",
        path: `/api/v1/clients/${h.clientId}/timeline?page=1&limit=50`,
      },
      {
        name: "HEAVY GET /client files",
        method: "GET",
        path: `/api/v1/clients/${h.clientId}/files?page=1&limit=50`,
      },
    );
  }

  if (h.patientPathwayId) {
    list.push({
      name: "HEAVY GET /patient-pathways/:id (include transitions)",
      method: "GET",
      path: `/api/v1/patient-pathways/${h.patientPathwayId}`,
    });
  }

  return list;
}

/** @returns {Promise<{ name?: string, method: string, path: string, body?: unknown, headers?: Record<string, string> }[]>} */
async function resolveEndpoints() {
  if (endpointsFile) {
    const abs = resolve(process.cwd(), endpointsFile);
    if (!existsSync(abs)) {
      console.error(`LATENCY_AUDIT_ENDPOINTS_FILE não encontrado: ${abs}`);
      process.exit(1);
    }
    const raw = JSON.parse(readFileSync(abs, "utf8"));
    if (!Array.isArray(raw)) {
      console.error("LATENCY_AUDIT_ENDPOINTS_FILE deve ser um JSON array");
      process.exit(1);
    }
    return raw;
  }

  if (!cookie) {
    return getPublicEndpoints();
  }

  let contextTenantId = process.env.LOAD_TEST_AUTH_CONTEXT_TENANT_ID?.trim() || null;
  if (!contextTenantId) {
    contextTenantId = await fetchMeTenantId();
  }

  const authed = [
    { name: "health + DB ping", method: "GET", path: "/api/v1/health" },
    { name: "/me (com cookie)", method: "GET", path: "/api/v1/me" },
    { name: "/clients (com cookie)", method: "GET", path: "/api/v1/clients" },
    { name: "/pathways (com cookie)", method: "GET", path: "/api/v1/pathways" },
    { name: "/patient-pathways (com cookie)", method: "GET", path: "/api/v1/patient-pathways" },
    { name: "/opme-suppliers (com cookie)", method: "GET", path: "/api/v1/opme-suppliers" },
    { name: "/notifications (com cookie)", method: "GET", path: "/api/v1/notifications" },
    { name: "/reports/summary (com cookie)", method: "GET", path: "/api/v1/reports/summary" },
    { name: "/tenant (com cookie)", method: "GET", path: "/api/v1/tenant" },
  ];

  const skipHeavy = process.env.LATENCY_AUDIT_SKIP_HEAVY === "1";
  if (!skipHeavy) {
    const heavyCtx = await discoverHeavyContext();
    const sid = (id) => (id && id.length > 14 ? `${id.slice(0, 12)}…` : id || "—");
    process.stderr.write(
      `[audit:api-latency] Bloco pesado — pathway=${sid(heavyCtx.pathwayId)} stage=${sid(heavyCtx.stageId)} client=${sid(heavyCtx.clientId)} pp=${sid(heavyCtx.patientPathwayId)}\n`,
    );
    authed.push(...buildHeavyEndpoints(heavyCtx));
  }

  if (contextTenantId) {
    authed.push({
      name: "auth/context POST (com cookie)",
      method: "POST",
      path: "/api/v1/auth/context",
      body: { tenantId: contextTenantId },
    });
  } else {
    console.warn(
      "[audit:api-latency] Sem tenantId (GET /me falhou ou user sem tenant). Pulando POST /api/v1/auth/context. Defina LOAD_TEST_AUTH_CONTEXT_TENANT_ID se precisar.",
    );
  }

  return authed;
}

/**
 * Percentil por “nearest rank” — suficiente para poucas iterações.
 * @param {number[]} sortedAsc
 * @param {number} pct 0–100
 */
function percentile(sortedAsc, pct) {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  const idx = Math.min(n - 1, Math.max(0, Math.ceil((pct / 100) * n) - 1));
  return sortedAsc[idx];
}

/**
 * @param {number[]} samplesMs
 */
function summarize(samplesMs) {
  const s = [...samplesMs].sort((a, b) => a - b);
  const n = s.length;
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n,
    min: s[0] ?? 0,
    max: s[n - 1] ?? 0,
    avg: n ? sum / n : 0,
    p50: percentile(s, 50),
    p95: percentile(s, 95),
    p99: percentile(s, 99),
  };
}

/**
 * @param {{ name?: string, method: string, path: string, body?: unknown, headers?: Record<string, string> }} spec
 */
async function measureEndpoint(spec) {
  const label = spec.name ?? `${spec.method} ${spec.path}`;
  const path = spec.path.startsWith("/") ? spec.path : `/${spec.path}`;
  const url = `${base}${path}`;
  const headers = {
    Accept: "application/json",
    ...(spec.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...spec.headers,
  };

  const timings = [];
  /** @type {Record<string, number>} */
  const statusHistogram = {};
  let errorCount = 0;

  const runOnce = async () => {
    const t0 = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: spec.method,
        headers,
        body: spec.body !== undefined ? JSON.stringify(spec.body) : undefined,
        signal: controller.signal,
      });
      const ms = performance.now() - t0;
      timings.push(ms);
      const st = String(res.status);
      statusHistogram[st] = (statusHistogram[st] ?? 0) + 1;
      await res.arrayBuffer().catch(() => {});
    } catch {
      errorCount += 1;
    } finally {
      clearTimeout(timer);
    }
  };

  const runRound = () => Promise.all(Array.from({ length: concurrency }, () => runOnce()));

  for (let i = 0; i < warmup; i++) {
    await runRound();
  }

  timings.length = 0;
  errorCount = 0;
  Object.keys(statusHistogram).forEach((k) => delete statusHistogram[k]);

  for (let i = 0; i < iterations; i++) {
    await runRound();
  }

  const stats = summarize(timings);
  const statuses = Object.entries(statusHistogram)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}×${v}`)
    .join(", ");
  const statusWithErrors =
    errorCount > 0 ? `${statuses || "—"} err×${errorCount}` : statuses;

  /** @type {Error|null} */
  const lastErr = errorCount > 0 ? new Error(`${errorCount} falhas rede/timeout`) : null;

  return { label, stats, statuses: statusWithErrors, lastErr, url, errorCount };
}

async function main() {
  const endpoints = await resolveEndpoints();

  const samplesPerEndpoint = iterations * concurrency;
  console.log(`
=== Bucomax — auditoria de latência HTTP ===
Base:          ${base}
Rodadas:       ${iterations} × concorrência ${concurrency} ≈ ${samplesPerEndpoint} req/endpoint (warmup ${warmup} rodadas)
Timeout:       ${timeoutMs} ms
Cookie:        ${cookie ? "sim" : "não"}
`);

  const results = [];
  for (const spec of endpoints) {
    process.stdout.write(`→ ${spec.name ?? spec.path} `);
    const row = await measureEndpoint(spec);
    results.push(row);
    const errPart = row.errorCount ? `, ${row.errorCount} erros` : "";
    console.log(`ok (${row.stats.n} amostras${errPart})`);
    if (row.lastErr && row.errorCount) {
      console.warn(`  aviso: ${row.lastErr.message}`);
    }
  }

  const sorted = [...results].sort((a, b) => b.stats.p95 - a.stats.p95);

  console.log("\n── Ranking por p95 (mais lento primeiro) ──\n");
  /** `console.table` largo quebra em terminais estreitos (linhas “duplicadas”). */
  const termW = process.stdout.columns ?? 96;
  const statusW = 18;
  const nameMax = Math.max(24, Math.min(40, termW - 58 - statusW));
  const hdr = `${"p95ms".padStart(6)} ${"p50".padStart(5)} ${"p99".padStart(5)} ${"max".padStart(5)} ${"avg".padStart(5)}  ${"status".padEnd(statusW)} endpoint`;
  console.log(hdr);
  console.log("-".repeat(Math.min(termW, hdr.length)));
  for (const r of sorted) {
    const ep = r.label.length > nameMax ? `${r.label.slice(0, nameMax - 1)}…` : r.label;
    const st = (r.statuses || "—").slice(0, statusW);
    console.log(
      `${r.stats.p95.toFixed(1).padStart(6)} ${r.stats.p50.toFixed(1).padStart(5)} ${r.stats.p99.toFixed(1).padStart(5)} ${r.stats.max.toFixed(1).padStart(5)} ${r.stats.avg.toFixed(1).padStart(5)}  ${st.padEnd(statusW)} ${ep}`,
    );
  }

  console.log("\nNotas:");
  console.log("- Muitos 429 = rate limit da API (~120/min por userId com Redis).");
  console.log("- Sem RL em dev: LOAD_TEST_DISABLE_API_RL=1 no .env + reinício do Next.");
  console.log("- err = timeout/rede; GET /health não usa o mesmo rateLimit(api).");
  console.log("- SQL: npm run audit:prisma-queries | Postgres pg_stat_statements.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
