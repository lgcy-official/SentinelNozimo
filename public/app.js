const state = {
  appName: "sentinel",
  sources: [],
  selectedSources: new Set(),
  memories: [],
  busy: false
};

const els = {
  appName: document.querySelector("#app-name"),
  sourceList: document.querySelector("#source-list"),
  sourceFilter: document.querySelector("#source-filter"),
  sourceCount: document.querySelector("#source-count"),
  memoryList: document.querySelector("#memory-list"),
  memoryCount: document.querySelector("#memory-count"),
  messages: document.querySelector("#messages"),
  form: document.querySelector("#chat-form"),
  prompt: document.querySelector("#prompt"),
  sendButton: document.querySelector("#send-button"),
  status: document.querySelector("#connection-status"),
  connectButton: document.querySelector("#connect-button"),
  retrievalState: document.querySelector("#retrieval-state"),
  retrievalList: document.querySelector("#retrieval-list"),
  resultCount: document.querySelector("#result-count"),
  scopeLabel: document.querySelector("#scope-label")
};

init();

async function init() {
  wireEvents();

  try {
    const config = await getJson("/api/config");
    state.appName = config.appName || "sentinel";
    els.appName.textContent = state.appName;

    if (!config.hasApiKey) {
      setStatus("Missing API key", "warning");
      addAssistantMessage("Set HYPERSPELL_API_KEY in `.env` so Sentinel can query your company data.");
      return;
    }

    await refreshSources();
  } catch (error) {
    setStatus("Local server issue", "warning");
    addAssistantMessage(formatError(error));
  }
}

function wireEvents() {
  els.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await askQuestion(els.prompt.value);
  });

  els.prompt.addEventListener("input", () => {
    els.prompt.style.height = "auto";
    els.prompt.style.height = `${Math.min(els.prompt.scrollHeight, 180)}px`;
  });

  els.prompt.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      els.form.requestSubmit();
    }
  });

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      els.prompt.value = button.dataset.prompt;
      els.form.requestSubmit();
    });
  });

  els.connectButton.addEventListener("click", openConnect);
}

async function refreshSources() {
  setStatus("Syncing source list");
  const payload = await getJson("/api/connections");
  state.sources = payload.sources || [];
  state.memories = payload.memories || [];
  renderSources();
  renderMemories();

  const connected = state.sources.filter((source) => source.connected).length;
  setStatus(connected ? `${connected} sources available` : "No sources connected", connected ? "" : "warning");
}

function renderSources() {
  els.sourceList.innerHTML = "";
  els.sourceFilter.innerHTML = "";

  const connectedSources = state.sources.filter((source) => source.connected);
  els.sourceCount.textContent = String(connectedSources.length);

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `filter-pill ${state.selectedSources.size === 0 ? "active" : ""}`;
  allButton.textContent = "All sources";
  allButton.addEventListener("click", () => {
    state.selectedSources.clear();
    renderSources();
    updateScope();
  });
  els.sourceFilter.append(allButton);

  for (const source of state.sources) {
    const selected = state.selectedSources.has(source.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `source-item ${selected ? "active" : ""}`;
    button.innerHTML = `
      <span class="source-icon">${sourceInitials(source.label)}</span>
      <span>
        <span class="source-name">${escapeHtml(source.label)}</span>
        <span class="source-meta">${source.connected ? `${source.documentCount} docs indexed` : "Ready to connect"}</span>
      </span>
      <span class="source-dot ${source.connected ? "connected" : ""}"></span>
    `;
    button.addEventListener("click", () => toggleSource(source.id));
    els.sourceList.append(button);

    if (source.connected) {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = `filter-pill ${selected ? "active" : ""}`;
      pill.textContent = source.label;
      pill.addEventListener("click", () => toggleSource(source.id));
      els.sourceFilter.append(pill);
    }
  }

  updateScope();
}

function renderMemories() {
  els.memoryList.innerHTML = "";
  els.memoryCount.textContent = String(state.memories.length);

  if (state.memories.length === 0) {
    els.memoryList.innerHTML = `<div class="empty-state">Indexed documents will show here after a source syncs.</div>`;
    return;
  }

  for (const memory of state.memories.slice(0, 8)) {
    const item = document.createElement("div");
    item.className = "memory-item";
    item.innerHTML = `
      <p class="memory-title">${escapeHtml(memory.title || memory.resource_id || "Untitled memory")}</p>
      <p class="memory-meta">${escapeHtml(formatSource(memory.source))} - ${escapeHtml(formatDate(memory.metadata?.indexed_at || memory.metadata?.created_at))}</p>
    `;
    els.memoryList.append(item);
  }
}

function toggleSource(sourceId) {
  if (state.selectedSources.has(sourceId)) {
    state.selectedSources.delete(sourceId);
  } else {
    state.selectedSources.add(sourceId);
  }

  renderSources();
}

async function askQuestion(rawQuestion) {
  const question = rawQuestion.trim();
  if (!question || state.busy) return;

  state.busy = true;
  state.lastQuery = question;
  els.sendButton.disabled = true;
  els.prompt.value = "";
  els.prompt.style.height = "auto";

  addUserMessage(question);
  const loading = addAssistantMessage("Searching the company brain...");

  try {
    const payload = await postJson("/api/chat", {
      query: question,
      sources: [...state.selectedSources],
      maxResults: 8
    });

    const answer = payload.answer || fallbackAnswer(payload.documents);
    loading.querySelector(".bubble").innerHTML = renderAnswer(answer, payload.documents || [], payload.errors || []);
    renderRetrieval(payload.documents || []);
  } catch (error) {
    loading.querySelector(".bubble").innerHTML = `<p>${escapeHtml(formatError(error))}</p>`;
  } finally {
    state.busy = false;
    els.sendButton.disabled = false;
    els.messages.scrollTop = els.messages.scrollHeight;
  }
}

function addUserMessage(text) {
  const article = document.createElement("article");
  article.className = "message user";
  article.innerHTML = `
    <div class="avatar">You</div>
    <div class="bubble"><p>${escapeHtml(text)}</p></div>
  `;
  els.messages.append(article);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function addAssistantMessage(text) {
  const article = document.createElement("article");
  article.className = "message assistant";
  article.innerHTML = `
    <div class="avatar">S</div>
    <div class="bubble"><p>${escapeHtml(text)}</p></div>
  `;
  els.messages.append(article);
  els.messages.scrollTop = els.messages.scrollHeight;
  return article;
}

function renderAnswer(answer, documents, errors) {
  const paragraphs = escapeHtml(answer)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");

  const citations = documents.slice(0, 5).map((doc) => `
    <div class="citation">
      <strong>${escapeHtml(doc.title || doc.resource_id || "Untitled source")}</strong>
      <span>${escapeHtml(formatSource(doc.source))}${doc.score ? ` - score ${Number(doc.score).toFixed(2)}` : ""}</span>
    </div>
  `).join("");

  const warning = errors.length
    ? `<div class="citation"><strong>Some sources could not be searched</strong><span>${escapeHtml(errors.map((error) => error.message || error.error || "Unknown error").join("; "))}</span></div>`
    : "";

  return `${paragraphs}${citations || warning ? `<div class="citation-list">${citations}${warning}</div>` : ""}`;
}

function renderRetrieval(documents) {
  els.retrievalList.innerHTML = "";
  els.resultCount.textContent = String(documents.length);
  els.retrievalState.classList.toggle("is-hidden", documents.length > 0);

  for (const doc of documents.slice(0, 8)) {
    const item = document.createElement("div");
    item.className = "retrieval-item";
    
    let actionsHtml = "";
    if (doc.source === "google_mail") {
      actionsHtml = `<button class="action-btn draft-reply-btn" data-resource-id="${escapeHtml(doc.resource_id)}">Draft Reply</button>`;
    }

    item.innerHTML = `
      <p class="retrieval-title">${escapeHtml(doc.title || doc.resource_id || "Untitled source")}</p>
      <p class="retrieval-meta">${escapeHtml(formatSource(doc.source))}${doc.metadata?.url ? ` - ${escapeHtml(doc.metadata.url)}` : ""}</p>
      ${doc.text ? `<p class="retrieval-snippet">${escapeHtml(doc.text.substring(0, 200))}...</p>` : ""}
      ${actionsHtml ? `<div class="retrieval-actions">${actionsHtml}</div>` : ""}
    `;
    els.retrievalList.append(item);
  }

  // Bind click handlers for draft reply buttons
  document.querySelectorAll(".draft-reply-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const resourceId = e.target.dataset.resourceId;
      e.target.textContent = "Drafting...";
      e.target.disabled = true;
      
      try {
        await postJson("/api/action/draft", {
          resourceId,
          query: state.lastQuery || "Reply to this email"
        });
        e.target.textContent = "Draft Created!";
        e.target.classList.add("success");
      } catch (err) {
        e.target.textContent = "Error";
        e.target.classList.add("error");
        console.error(err);
      }
    });
  });
}

async function openConnect() {
  try {
    const payload = await getJson(`/api/connect-url?redirect_uri=${encodeURIComponent(window.location.href)}`);
    if (payload.url) {
      window.location.href = payload.url;
    }
  } catch (error) {
    addAssistantMessage(`I could not open Hyperspell Connect yet: ${formatError(error)}`);
  }
}

function fallbackAnswer(documents = []) {
  if (!documents.length) {
    return "I could not find matching company documents for that question. Try connecting a source or broadening the scope.";
  }

  return `I found ${documents.length} relevant source${documents.length === 1 ? "" : "s"}. Review the citations below for the strongest matches.`;
}

async function getJson(path) {
  const response = await fetch(path);
  return parseResponse(response);
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse(response);
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Request failed with ${response.status}`);
  }
  return payload;
}

function setStatus(text, mode = "") {
  els.status.textContent = text;
  els.status.classList.toggle("warning", mode === "warning");
}

function updateScope() {
  if (state.selectedSources.size === 0) {
    els.scopeLabel.textContent = "All";
    return;
  }

  els.scopeLabel.textContent = `${state.selectedSources.size} selected`;
}

function sourceInitials(label) {
  return label
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

function formatSource(source = "unknown") {
  const match = state.sources.find((item) => item.id === source);
  if (match) return match.label;
  return source.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatError(error) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
