# BrainDump — CLAUDE.md

## Purpose
Chat-based interface for interacting with the MTA brain vault. Two modes:
- **Train Mode**: Teach the brain new facts → Claude AI stages file changes → committed to brain git repo
- **Discover Mode**: Ask questions about what's in the vault

This is the primary human → brain vault input channel.

## Tech Stack
- Next.js 15 (App Router), React 19
- Anthropic SDK (Claude API for AI-assisted staging)
- API routes: `/api/chat`, `/api/commit`, `/api/chats`, `/api/debug`
- Persists chat history to disk (`chats/` directory)
- Deployment: Railway via Nixpacks (Node 22), standalone output
- `BRAIN_REPO_URL` env var — which brain repo to connect to

## Local Development
```bash
cd ~/Documents/GitHub/braindump
npm install
# Set ANTHROPIC_API_KEY and BRAIN_REPO_URL in .env.local
npm run dev  # runs on port 3002
```

## Status
**Active — deployed on Railway. Has local uncommitted changes:**
- `app/api/chat/route.ts`
- `app/api/commit/route.ts`
- `app/page.tsx`
- `lib/vault.ts`
- New untracked dirs: `chats/`, `api/chats/`, `api/debug/`

**NO GitHub remote configured yet** — needs `git remote add origin git@github.com:stephenpriorhub/braindump.git` (create repo first).

## Hub Integration
- Status: **needs verification** — check if hub-nav.js is in `app/layout.tsx`
- If missing: add hub-nav.js with project cuid from hub admin
- This app should be protected — only MTA team members should access it

## Relationship to Brain Vault
The brain vault is at `~/Documents/github/brain`. BrainDump writes to it via git commits. All input to the brain should flow through BrainDump (Train Mode) or be captured automatically from other apps via Brain Master capture hooks.
