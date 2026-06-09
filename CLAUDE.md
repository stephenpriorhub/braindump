# Braindump — CLAUDE.md

## Purpose
A Next.js app related to brain vault visualization or interaction. Connected to or part of the "Brain App" registered in OxfordHub. May be combined with or the same as the Brain Map app in `/Documents/github/brain/Projects/brain-map`.

## Status
**Needs investigation** — clarify relationship to Brain App in OxfordHub and brain/Projects/brain-map.

## Tech Stack
- Next.js (App Router)
- nixpacks.toml — Railway Nixpacks deployment

## Next Steps
1. Clarify: Is this the same as the Brain App already in OxfordHub?
2. If yes: ensure hub-nav.js integration is present
3. If no: determine purpose and whether to integrate or deprecate
4. Brief Brain Master on what data this app surfaces from the vault

## Hub Integration Check
- Does `app/layout.tsx` have hub-nav.js? Check and add if missing.
- Does `app/globals.css` have `html { visibility: hidden }`? Add if missing.
- What is the hub project cuid? Check oxfordhub.app/admin/projects.
