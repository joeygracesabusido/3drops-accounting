# Design Document: `update-docs` Skill

**Date:** 2026-03-10
**Topic:** Next.js Documentation Update Skill

## Overview
The `update-docs` skill is designed to help keep the HRIS Philippines project's documentation (like `GEMINI.md` and files in `docs/`) in sync with the latest Next.js features and best practices from the official Next.js repository.

## Goals
- Automate the discovery of new Next.js patterns (App Router, Server Actions, Middleware).
- Audit existing project documentation for outdated or deprecated Next.js patterns.
- Provide a curated set of local references for rapid, offline documentation updates.
- Enable live fetching of documentation from the Next.js GitHub repository.

## Architecture & Modes

### 1. Reference Mode (The "Vault")
- **Resource:** `references/nextjs-core-patterns.md`, `references/nextjs-server-actions.md`, `references/nextjs-middleware-auth.md`.
- **Function:** Provides immediate, high-quality guidance based on pre-vetted Next.js 14/15 standards.

### 2. Research Mode (The "Live Researcher")
- **Resource:** `web_fetch` tool.
- **Function:** Fetches the latest documentation directly from `https://github.com/vercel/next.js/tree/canary/docs` when requested.

### 3. Audit Mode (The "Doc Auditor")
- **Function:** Scans `docs/` and `GEMINI.md` to identify gaps or outdated patterns (e.g., Pages Router artifacts in an App Router project) and proposes updates.

## Components
- `SKILL.md`: Orchestrates the modes and handles the `update-docs` logic.
- `references/`: Local markdown files summarizing key Next.js concepts.
- `scripts/`: (Optional) Scripts to automate the comparison of local docs with remote sources.

## Data Flow
1. **Trigger:** User request like "Update my docs with the latest Next.js best practices."
2. **Context Check:** Skill reads `package.json` to identify the current Next.js version.
3. **Execution:** Skill chooses between Vault, Live Researcher, or Auditor based on the specific query.
4. **Verification:** Skill ensures proposed documentation changes are compatible with the project's architecture.

## Success Criteria
- Successfully identifies at least one outdated pattern or missing documentation section.
- Correctly fetches and summarizes documentation from the Next.js GitHub repository.
- Updates `GEMINI.md` or a file in `docs/` with accurate, version-appropriate Next.js guidance.
