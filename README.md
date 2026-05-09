<div align="center">
  <h1>🛡️ Sentinel: The Agentic Company Brain</h1>
  <p><strong>Unify your company's scattered knowledge and turn it into an intelligent, action-taking assistant.</strong></p>
  
  [![Hackathon Project](https://img.shields.io/badge/Hackathon-Winner-gold.svg?style=for-the-badge)](https://github.com)
  [![Built with Hyperspell](https://img.shields.io/badge/Powered_by-Hyperspell-8a2be2.svg?style=for-the-badge)](https://hyperspell.com)
</div>

<br />

## 🚨 The Problem
Modern companies suffer from severe **data fragmentation**. Critical context, decisions, and documents are scattered across Slack, Notion, Google Drive, GitHub, and Gmail. 

When an employee needs to answer a question or write a follow-up email, they spend 80% of their time hunting down the context across 5 different tools. **Search is broken, and it's slowing teams down.**

## 💡 Our Solution: Sentinel
Sentinel is a centralized "Company Brain" built on top of **Hyperspell**. We don't just solve search; we solve *action*.

Sentinel acts as an **Agentic Assistant** that ingests and understands your entire workspace in real-time. Instead of just giving you a list of links, it synthesizes highly accurate answers and allows you to **take immediate action** right from the interface.

### ✨ Key Features
- **🧠 Universal Memory Layer:** Instantly search across Google Drive, Notion, Slack, GitHub, and Gmail without switching tabs.
- **⚡ Advanced AI Synthesis:** Powered by the `gpt-oss-120b` model, Sentinel reads multiple documents to give you highly detailed, specific answers rather than generic summaries.
- **🤖 Agentic Actions (Write-Back):** Sentinel doesn't just read your data—it acts on it. Find an email thread? Click "Draft Reply" and Sentinel will use your company's collective knowledge to draft a professional response directly into your Gmail drafts folder.
- **🕸️ Instant Web Crawling:** Connect the Web Crawler integration to ingest a competitor's website or an API documentation portal on the fly.

---

## 🛠️ Tech Stack
Sentinel is built to be blisteringly fast and lightweight:

- **Frontend:** Pure Vanilla JavaScript, HTML5, and CSS3 (No bulky frameworks, just raw performance).
- **Backend:** Node.js (Vanilla HTTP server).
- **AI & Memory Infrastructure:** [Hyperspell API / SDK](https://hyperspell.com) handles all the OAuth connections, vector embeddings, document chunking, natural language search, and agentic action routing.

---

## 🚀 Getting Started

### 1. Environment Setup
Rename the `.env.example` file to `.env` and configure your API key. *(Note: We use `.env.example` to ensure no sensitive API keys are ever committed to the repository.)*

```bash
cp .env.example .env
```

Open `.env` and add your Hyperspell API Key:
```env
HYPERSPELL_API_KEY=hs-your-api-key-here
HYPERSPELL_USER_ID=sentinel
APP_NAME=sentinel
PORT=8787
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Server
```bash
npm start
```
The app will be running at [http://127.0.0.1:8787](http://127.0.0.1:8787). 

### 4. Connect Your Data
Click the **"Connect Data"** button in the top right corner of the Sentinel UI to securely link your Google Workspace, Notion, Slack, and GitHub accounts using Hyperspell's secure OAuth flow.

---

## 🔮 What's Next?
- **Auto-Wiki Generation:** Leverage Hyperspell's Context Document API to automatically generate massive, structured onboarding wikis in Google Drive based on all connected data.
- **Slack Agentic Replies:** Add the ability for the AI to instantly reply in Slack threads to answer teammate questions automatically.

<br />
<div align="center">
  <i>Built with ❤️ for the 2026 Hackathon.</i>
</div>
