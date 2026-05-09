import Hyperspell from "@hyperspell/hyperspell";

export const hyperspellSources = [
  "reddit",
  "notion",
  "slack",
  "google_calendar",
  "google_mail",
  "box",
  "dropbox",
  "github",
  "google_drive",
  "vault",
  "web_crawler",
  "trace",
  "microsoft_teams",
  "gmail_actions"
];

export function createHyperspellClient(userId) {
  if (!process.env.HYPERSPELL_API_KEY) {
    throw new Error("Set HYPERSPELL_API_KEY in .env before using Hyperspell.");
  }

  return new Hyperspell({
    apiKey: process.env.HYPERSPELL_API_KEY,
    userID: userId || process.env.HYPERSPELL_USER_ID || "sentinel"
  });
}

export async function searchMemories(userId, query, options = {}) {
  const client = createHyperspellClient(userId);
  const { answer = true, sources, maxResults = 8, effort = "high", answerModel = "gpt-oss-120b" } = options;
  const body = {
    query,
    answer,
    effort,
    options: {
      max_results: maxResults,
      answer_model: answerModel
    }
  };

  if (Array.isArray(sources) && sources.length > 0) {
    body.sources = sources.filter((source) => hyperspellSources.includes(source));
  }

  return client.memories.search(body);
}

export async function listConnections(userId) {
  return createHyperspellClient(userId).connections.list();
}

export async function listMemories(userId, params = {}) {
  const page = await createHyperspellClient(userId).memories.list(params);
  return page.getPaginatedItems ? page.getPaginatedItems() : page.data || [];
}

export async function getMemoryStatus(userId) {
  return createHyperspellClient(userId).memories.status();
}

export async function getHyperspellUser(userId) {
  return createHyperspellClient(userId).auth.me();
}

export async function createUserToken(userId, origin) {
  const client = new Hyperspell({
    apiKey: process.env.HYPERSPELL_API_KEY
  });

  const response = await client.auth.userToken({
    user_id: userId,
    origin,
    expires_in: "24h"
  });

  return response.token;
}

export async function createEmailDraft(userId, { to, subject, body, threadId }) {
  const response = await fetch("https://api.hyperspell.com/actions/create_draft", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.HYPERSPELL_API_KEY}`,
      "Content-Type": "application/json",
      "X-As-User": userId || "sentinel"
    },
    body: JSON.stringify({
      provider: "gmail_actions",
      to,
      subject,
      body,
      thread_id: threadId
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create draft: ${error}`);
  }
  return response.json();
}

export async function getMemory(userId, provider, resourceId) {
  const response = await fetch(`https://api.hyperspell.com/memories/${encodeURIComponent(provider)}/${encodeURIComponent(resourceId)}`, {
    headers: {
      "Authorization": `Bearer ${process.env.HYPERSPELL_API_KEY}`,
      "X-As-User": userId || "sentinel"
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get memory: ${error}`);
  }
  return response.json();
}
