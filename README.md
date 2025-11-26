# ASVAB Study Website — How it helps you master fundamentals

This site guides learners from core concepts to reliable problem solving by combining clear fundamentals with pattern and keyword recognition so users can map problems to the right formula and solve them consistently.

## Key principles

- Focus on fundamentals: concise lessons that explain definitions, concepts, and why they matter.
- Pattern recognition: catalog common problem types and show how to recognize them quickly.
- Keyword recognition: highlight trigger words and phrases that indicate which approach or formula to use.
- Formula mapping: present the appropriate formula, show its derivation/intuition, and demonstrate when to apply it.
- Active practice: scaffolded examples, immediate feedback, and targeted drills to reinforce learning.

## How the learning flow works

1. Learn the core concept (short text + visual where helpful).
2. See 2–3 canonical examples with step‑by‑step solutions.
3. Study the pattern checklist (what a problem looks like).
4. Review keyword cues that point to the pattern or formula.
5. Apply through adaptive practice problems that increase in difficulty.
6. Get instant explanations that reference the pattern, keywords, and formula used.
7. Track mastery and revisit weak patterns via spaced review.

## Features that support mastery

- Pattern library: searchable list of problem archetypes with examples.
- Keyword index: quick lookup of trigger words and the recommended approach.
- Interactive worked examples: click to reveal each solution step and rationale.
- Adaptive quizzes: focus practice on patterns you haven’t mastered.
- Progress dashboard: mastery levels by topic and recommended next steps.

## Practical study tips for users

- Study a single concept and its patterns before attempting mixed problem sets.
- Verbalize the keyword(s) you see and the pattern you expect before solving.
- Try to predict the formula or first step, then solve and compare.
- Use spaced repetition: short daily sessions focusing on weak patterns.

## How to use the site

1. Pick a subject (e.g., arithmetic reasoning, Mathematics Knowledge).
2. Read the fundamentals and pattern checklist.
3. Complete guided examples.
4. Take the short adaptive quiz.
5. Review explanations for any missed items and repeat practice.

This approach turns unfamiliar problems into recognizable patterns, links keywords to formulas, and builds reliable problem-solving habits for the ASVAB.

## Developer — Live reload / development server

To run the local dev server with Fast Refresh (updates as you edit files):

1. Start the dev server:

   npm run dev

2. Notes and troubleshooting:

- The project uses Next.js dev server which provides Fast Refresh for client components. Avoid wrapping `next dev` with tools that restart the process (e.g. `nodemon`) — that prevents HMR.
- If your filesystem is remote or uses network mounts, set the environment variable `CHOKIDAR_USEPOLLING=1` before running the dev server to enable polling-based file watching.
- If you still don't see live updates, check `next.config.ts` for `webpack.watchOptions`. The project is configured to ignore `node_modules` only so source files are watched correctly.
- For server components (under `src/app`), some changes may require a full server refresh; client components (with `"use client"`) will update without a full reload.

If you want, I can add a short npm script (e.g. `dev:poll`) that runs `CHOKIDAR_USEPOLLING=1 npm run dev` for networked filesystems.

The dashboard should also keep track of the user's current difficulty level based on how well they do as the question difficulties progress. If user is better at solving Easy questions they are at a level of "Easy"; if they have a balanced mix, "Intermediate"; if they solve many hard problems, "Hard".

## How difficulty is computed

- We compute a heuristic difficulty level from the canonical `asvab_attempt_log_v1` attempt log using the last 30 days of attempts.
- We count correct answers by difficulty (easy/medium/hard). If total correct answers in the window is fewer than 5 then the difficulty is shown as "Unknown".
- If at least 50% of correct answers are on hard and there are at least 5 hard corrects, the difficulty is "Hard".
- Else if at least 40% of correct answers are on medium and there are at least 5 medium corrects, the difficulty is "Intermediate".
- Else if at least 50% of correct answers are on easy and there are at least 5 easy corrects, the difficulty is "Easy".
- Otherwise the difficulty is considered "Intermediate" to indicate a balanced distribution.

## Data sources and counts

- Daily Training: lines up with the per-day Daily Training session cache and streak management. Only sessions completed through the Daily Training flow increment the daily streak and per-day counts.
- Study Mode: attempts made in the Study Mode are not counted toward Daily Training counts or streaks. They are still recorded in the centralized attempt log and thus count towards weekly/monthly summaries and the adaptive model. Detailed per-question attempts may also come from Study Mode, Quiz Mode, Full Tests, or live per-question answers.
- Weekly and Monthly: these are computed from the canonical `asvab_attempt_log_v1` attempt log. If you reset only the Daily Training cache, weekly/monthly totals will not change because they are built from the centralized attempt log. Use the Dashboard's Reset Attempt Log or Clear All Caches if you want to wipe period statistics entirely.

## Strengths / Areas to improve / Topics attempted

- The Dashboard shows top strengths (formulas where your mastery is highest), areas to improve (formulas with low mastery and sufficient attempts), and all topics you've attempted ordered by frequency.
- Strengths and Areas to Improve are computed from the adaptive model (derived from the attempt log). The heuristics favor formulas with more attempts to avoid noisy classification.
- If you want to adjust thresholds or consider different time windows, these values are derived from the last 30 days by default; we can add UI toggles for other windows if desired.

## AI generation and privacy

- By default the app uses the free Grok AI runtime on the client (via the `z-ai-web-dev-sdk`) to generate practice problems in real time. No server-side infrastructure is required — AI calls are performed directly from the user's device.
- If Grok is not available or the client cannot reach it, the app falls back to a deterministic, locally-executed generator to guarantee offline behaviour and full privacy.
- Problems are generated adaptively in real time and prioritized toward topics where numerical mastery is low, starting at an easier difficulty and increasing difficulty as the user answers correctly.
- To override the AI endpoint (for local dev or alternate providers), set `localStorage.setItem('ai_endpoint', '<your-endpoint-url>')` in the browser console. The app will prefer that endpoint when present.

## Deploying to GitHub Pages

This repository includes a workflow which builds the site and deploys a static export to the `gh-pages` branch.

How it works:

- A GitHub Actions workflow (at `.github/workflows/deploy-gh-pages.yml`) runs on pushes to `main` and builds a static export via `next export`.
- The export directory `out/` is published to the `gh-pages` branch using `peaceiris/actions-gh-pages`.

To enable GitHub Pages for this repo:

1. Open the repository Settings → Pages and set the source to the `gh-pages` branch and the root directory `/`.
2. If you use a custom domain, configure the CNAME as needed and set your domain in the Pages settings.
3. The action will publish the site to: `https://<your-org-or-username>.github.io/<your-repo>/` unless you set a custom domain.

Notes:

- Next.js static export (`next export`) will only produce a fully static site if your app does not depend on server-only features (API routes, server-side rendering, Next.js App Router server patterns). If your app uses server features, consider deploying with Vercel or a Node host (e.g. Railway, Render).
- If `next export` cannot produce a static export for all routes due to dynamic server requirements, the workflow will still export static pages it can generate; other routes may need an alternative host.
- If you prefer to manually deploy or run the deploy locally, the package.json includes `npm run export` to build the static files and `npm run deploy:gh-pages` to deploy via the `gh-pages` CLI.

## AI Settings & Debugging

- A new Settings dialog allows users to opt-in or out of client-side AI generation and to save that preference to their user profile. The setting is persisted to localStorage (`ai_enabled`) and optionally to the user model.
- The system tracks AI fallback events and logs them to `localStorage` (key: `ai_event_log`) and exposes a `getAiStatus()` helper that indicates whether SDK is available, endpoint presence, and fallback counts. The Settings dialog displays current AI status and allows clearing AI logs.

## Answer normalization and tolerant matching

- The platform now uses improved answer normalization for client-side answer checking. Numeric answers accept a small tolerance (default ±0.02) to account for floating point representation differences and minor rounding. Text answers are normalized and compared with a fuzzy similarity threshold so small typos won't falsely mark a correct answer as wrong. This change improves fairness across AI-generated and deterministic problem outputs.

## Running the Test Scripts

- There are small local test scripts under `/scripts` used for smoke testing and validation. Examples:
  - `scripts/smoke_dedupe.ts` — verifies deduping of attempt logs and model rebuild.
  - `scripts/test_ai_generation.ts` — validates AI generation & batch generation functions.
  - `scripts/test_answers.mjs` — a small test script that verifies answer comparison heuristics (run with `node scripts/test_answers_runner.mjs`).