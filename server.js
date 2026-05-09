import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createEmailDraft,
  getMemory,
  createUserToken,
  getHyperspellUser,
  getMemoryStatus,
  hyperspellSources,
  listConnections,
  listMemories,
  searchMemories
} from "./lib/hyperspell.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");

loadEnv();

const HYPERSPELL_API_KEY = process.env.HYPERSPELL_API_KEY;
const HYPERSPELL_USER_ID = process.env.HYPERSPELL_USER_ID || "sentinel";
const APP_NAME = process.env.APP_NAME || "sentinel";
const PORT = Number(process.env.PORT || 8787);

const sources = hyperspellSources;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, 500, {
      error: "ServerError",
      message: error instanceof Error ? error.message : "Unknown server error"
    });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Sentinel Company Brain running at http://127.0.0.1:${PORT}`);
});

async function handleApi(req, res, url) {
  if (url.pathname === "/api/config" && req.method === "GET") {
    sendJson(res, 200, {
      appName: APP_NAME,
      userId: HYPERSPELL_USER_ID,
      hasApiKey: Boolean(HYPERSPELL_API_KEY),
      availableSources: sources
    });
    return;
  }

  if (!HYPERSPELL_API_KEY) {
    sendJson(res, 500, {
      error: "MissingHyperspellApiKey",
      message: "Set HYPERSPELL_API_KEY in .env before querying company data."
    });
    return;
  }

  if (url.pathname === "/api/chat" && req.method === "POST") {
    const body = await readJson(req);
    const query = String(body.query || "").trim();

    if (!query) {
      sendJson(res, 400, { error: "MissingQuery", message: "Enter a question first." });
      return;
    }

    const selectedSources = Array.isArray(body.sources)
      ? body.sources.filter((source) => sources.includes(source))
      : [];

    const detailedQuery = `${query}\n\nPlease provide a detailed response with specifics from the documents.`;

    const payload = {
      query: detailedQuery,
      answer: true,
      effort: 1,
      options: {
        max_results: Number(body.maxResults || 8)
      }
    };

    if (selectedSources.length > 0) {
      payload.sources = selectedSources;
    }

    const result = await searchMemories(HYPERSPELL_USER_ID, detailedQuery, {
      answer: true,
      sources: payload.sources,
      maxResults: payload.options.max_results,
      effort: "high"
    });

    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/action/draft" && req.method === "POST") {
    const body = await readJson(req);
    const { resourceId, query } = body;
    
    try {
      const memory = await getMemory(HYPERSPELL_USER_ID, "google_mail", resourceId);
      
      const prompt = `Draft a professional email reply to the following email. The user's query context was: "${query}".\n\nEmail Content:\n${memory.text || memory.title}`;
      const searchResult = await searchMemories(HYPERSPELL_USER_ID, prompt, { answer: true, maxResults: 1 });
      const draftedBody = searchResult.answer || "Hello,\n\nI am writing to reply to your email.";
      
      const to = memory.metadata?.from ? [memory.metadata.from] : [];
      let subject = memory.metadata?.subject || "Re: Update";
      if (!subject.toLowerCase().startsWith("re:")) {
        subject = `Re: ${subject}`;
      }
      const threadId = memory.metadata?.thread_id;
      
      const result = await createEmailDraft(HYPERSPELL_USER_ID, {
        to,
        subject,
        body: draftedBody,
        threadId
      });
      
      sendJson(res, 200, { success: true, result });
    } catch (error) {
      console.error("Draft error:", error);
      sendJson(res, 500, { error: "DraftError", message: error.message });
    }
    return;
  }

  if (url.pathname === "/api/memories" && req.method === "GET") {
    const size = clamp(Number(url.searchParams.get("size") || 50), 1, 100);
    const source = url.searchParams.get("source");
    const params = new URLSearchParams({ size: String(size) });

    if (source && sources.includes(source)) {
      params.set("source", source);
    }

    const result = await listMemories(HYPERSPELL_USER_ID, Object.fromEntries(params));
    sendJson(res, 200, { items: result });
    return;
  }

  if (url.pathname === "/api/connections" && req.method === "GET") {
    const [me, connections, memories, status] = await Promise.allSettled([
      getHyperspellUser(HYPERSPELL_USER_ID),
      listConnections(HYPERSPELL_USER_ID),
      listMemories(HYPERSPELL_USER_ID, { size: 100 }),
      getMemoryStatus(HYPERSPELL_USER_ID)
    ]);

    const mePayload = me.status === "fulfilled" ? me.value : null;
    const connectionPayload = connections.status === "fulfilled" ? connections.value : null;
    const memoryPayload = memories.status === "fulfilled" ? { items: memories.value } : { items: [] };
    const statusPayload = status.status === "fulfilled" ? status.value : null;

    sendJson(res, 200, normalizeSources(connectionPayload, memoryPayload, mePayload, statusPayload));
    return;
  }

  if (url.pathname === "/api/diagnostics" && req.method === "GET") {
    const [me, connections, status, memories] = await Promise.allSettled([
      getHyperspellUser(HYPERSPELL_USER_ID),
      listConnections(HYPERSPELL_USER_ID),
      getMemoryStatus(HYPERSPELL_USER_ID),
      listMemories(HYPERSPELL_USER_ID, { size: 10 })
    ]);

    sendJson(res, 200, {
      appName: APP_NAME,
      userId: HYPERSPELL_USER_ID,
      me: settledValue(me),
      connections: settledValue(connections),
      indexing: settledValue(status),
      memories: settledValue(memories),
      errors: [me, connections, status, memories]
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason?.message || "Unknown Hyperspell error")
    });
    return;
  }

  if (url.pathname === "/api/connect-url" && req.method === "GET") {
    const redirect = url.searchParams.get("redirect_uri") || `http://127.0.0.1:${PORT}`;
    const origin = new URL(redirect).origin;
    const token = await createUserToken(HYPERSPELL_USER_ID, origin);
    const connectUrl = new URL("https://connect.hyperspell.com");
    connectUrl.searchParams.set("token", token);
    connectUrl.searchParams.set("redirect_uri", redirect);
    connectUrl.searchParams.set("popup", "false");
    sendJson(res, 200, { url: connectUrl.toString() });
    return;
  }

  sendJson(res, 404, { error: "NotFound", message: "No matching API route." });
}

function normalizeSources(connectionPayload, memoryPayload, mePayload = null, statusPayload = null) {
  const items = Array.isArray(memoryPayload?.items) ? memoryPayload.items : [];
  const docsBySource = new Map();

  for (const item of items) {
    const source = item.source || "unknown";
    docsBySource.set(source, (docsBySource.get(source) || 0) + 1);
  }

  if (statusPayload?.providers) {
    for (const [source, counts] of Object.entries(statusPayload.providers)) {
      const total = Object.values(counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
      if (total > 0) docsBySource.set(source, Math.max(docsBySource.get(source) || 0, total));
    }
  }

  const rawConnections = Array.isArray(connectionPayload)
    ? connectionPayload
    : connectionPayload?.connections || connectionPayload?.items || [];

  const connectedBySource = new Set(
    rawConnections.map((connection) => connection.provider || connection.source || connection.integration || connection.type)
  );

  const availableSources = Array.isArray(mePayload?.available_integrations) && mePayload.available_integrations.length
    ? mePayload.available_integrations
    : sources;

  const installedSources = new Set(
    Array.isArray(mePayload?.installed_integrations) ? mePayload.installed_integrations : []
  );

  return {
    sources: availableSources.map((source) => ({
      id: source,
      label: humanizeSource(source),
      connected: connectedBySource.has(source) || installedSources.has(source) || docsBySource.has(source),
      documentCount: docsBySource.get(source) || 0
    })),
    memories: items.slice(0, 20),
    rawConnections,
    installedIntegrations: [...installedSources],
    availableIntegrations: availableSources
  };
}

async function serveStatic(pathname, res) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const normalized = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, normalized);

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  const finalPath = existsSync(filePath) ? filePath : join(publicDir, "index.html");
  const body = await readFile(finalPath);
  res.writeHead(200, {
    "Content-Type": mimeTypes[extname(finalPath)] || "application/octet-stream"
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body ? safeJson(body) : {}));
    req.on("error", reject);
  });
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function clamp(number, min, max) {
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function humanizeSource(source) {
  const names = {
    google_drive: "Google Drive",
    google_mail: "Gmail",
    google_calendar: "Google Calendar",
    microsoft_teams: "Microsoft Teams",
    web_crawler: "Web Crawler",
    gmail_actions: "Gmail Actions"
  };

  return names[source] || source.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function settledValue(result) {
  if (result.status === "fulfilled") return result.value;
  return { error: result.reason?.message || "Unknown Hyperspell error" };
}

function loadEnv() {
  const envPath = join(__dirname, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
