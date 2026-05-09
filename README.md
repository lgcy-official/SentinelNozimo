# Sentinel Company Brain

A small company-brain web app backed by Hyperspell. The browser talks only to this local Node server, and the server keeps the Hyperspell API key private.

## Run

```bash
npm start
```

Open `http://127.0.0.1:8787`.

## Configuration

Create a `.env` file from `.env.example`:

```bash
HYPERSPELL_API_KEY=...
HYPERSPELL_USER_ID=sentinel
APP_NAME=sentinel
PORT=8787
```

`HYPERSPELL_USER_ID` is the internal user namespace Hyperspell queries through `X-As-User`.

