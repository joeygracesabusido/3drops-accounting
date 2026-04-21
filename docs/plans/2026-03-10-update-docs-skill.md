# `update-docs` Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a skill that helps keep the HRIS Philippines project's documentation current with Next.js 14/15 best practices.

**Architecture:** A modular skill with local reference files ("Vault"), instructions for remote fetching ("Live Researcher"), and an audit workflow ("Doc Auditor"). It will reside in `skills/update-docs/`.

**Tech Stack:** Gemini CLI Skill Framework, Next.js 14/15 documentation.

---

### Task 1: Initialize the Skill Directory

**Files:**
- Create: `skills/update-docs/SKILL.md`
- Create: `skills/update-docs/references/nextjs-core-patterns.md`
- Create: `skills/update-docs/references/nextjs-server-actions.md`
- Create: `skills/update-docs/references/nextjs-middleware-auth.md`

**Step 1: Create the directory structure**

Run: `mkdir -p skills/update-docs/references`

**Step 2: Initialize SKILL.md with frontmatter**

```markdown
---
name: update-docs
description: Helps update and audit project documentation for Next.js 14/15 compliance. Use when you need to sync GEMINI.md or local docs with the latest patterns from the Next.js GitHub repository.
---

# Update Docs Skill

This skill provides workflows for keeping your project's documentation in sync with Next.js best practices.

## Core Workflows

1. **Vault Mode**: Use local references in `references/` for quick updates.
2. **Live Mode**: Use `web_fetch` to pull from `https://github.com/vercel/next.js/tree/canary/docs`.
3. **Audit Mode**: Scan `docs/` and `GEMINI.md` for outdated patterns.

## Instructions

- Check `package.json` for the current Next.js version before proposing changes.
- Prioritize App Router patterns (Server Components, layouts) over Pages Router patterns.
- Ensure all documentation updates are reflected in `GEMINI.md` if they affect project-wide mandates.
```

**Step 3: Commit**

```bash
git add skills/update-docs/SKILL.md
git commit -m "feat(skill): initialize update-docs skill"
```

### Task 2: Populate Reference Files (The "Vault")

**Files:**
- Modify: `skills/update-docs/references/nextjs-core-patterns.md`
- Modify: `skills/update-docs/references/nextjs-server-actions.md`

**Step 1: Write core patterns reference**

```markdown
# Next.js Core Patterns (v14/v15)

## App Router
- **Layouts**: Use `layout.tsx` for shared UI.
- **Server Components**: Default for all components in `app/`.
- **Client Components**: Use `'use client'` at the top.

## Data Fetching
- Use standard `async/await` in Server Components.
- Use `revalidatePath` or `revalidateTag` for on-demand revalidation.
```

**Step 2: Write server actions reference**

```markdown
# Next.js Server Actions

## Best Practices
- Define actions in separate files or with `'use server'` in Server Components.
- Use `useFormState` and `useFormStatus` (React 18) or `useActionState` (React 19/Next 15) for form handling.
- Always implement server-side validation using Zod.
```

**Step 3: Commit**

```bash
git add skills/update-docs/references/
git commit -m "feat(skill): add core reference files for update-docs"
```

### Task 3: Implement Audit Workflow in SKILL.md

**Files:**
- Modify: `skills/update-docs/SKILL.md`

**Step 1: Add Audit logic to SKILL.md**

```markdown
## Audit Workflow

1. Read `GEMINI.md` and `docs/*.md`.
2. Look for keywords like `getServerSideProps`, `getStaticProps`, or `pages/` that might indicate outdated documentation in an App Router project.
3. Propose updates using the local references in `references/`.
```

**Step 2: Commit**

```bash
git add skills/update-docs/SKILL.md
git commit -m "feat(skill): add audit workflow to update-docs skill"
```

### Task 4: Package and Test Initialization

**Files:**
- Create: `skills/update-docs.skill`

**Step 1: Package the skill**

Run: `node /usr/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/skills/builtin/skill-creator/scripts/package_skill.cjs skills/update-docs`

**Step 2: Install the skill locally**

Run: `gemini skills install skills/update-docs.skill --scope workspace`

**Step 3: Commit**

```bash
git add skills/update-docs.skill
git commit -m "feat(skill): package and install update-docs skill"
```
