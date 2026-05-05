# Setup Guide

End-to-end setup for the Sankey Dependency Graph widget — auth, dev harness, auto-deploy. This guide follows the standard `@customagile/widget-ai` setup pattern.

## Prerequisites

- Node 18+ and npm
- A Rally workspace and project you can access
- A Rally API key (instructions below)

## 1. Generate a Rally API key

1. Sign in to Rally.
2. Open the API key page: **<https://rally1.rallydev.com/#/api_key>** (or click your avatar → API Keys).
3. Click **Create**, give the key a name (e.g. `widget-dev`), pick the workspaces it can access, and copy the full key. It starts with `_` and is ~43 chars long.
4. Treat it like a password — don't paste it into anything that gets committed.

## 2. Configure auth (pick one)

The Vite dev server proxies `/slm/*` (WSAPI) to Rally. It needs a server URL and an API key. You have two options — they are read in this order, first non-empty wins:

### Option A — `auth.json` (per-widget, gitignored)

Create `auth.json` in the widget folder:

```json
{
  "server": "https://rally1.rallydev.com",
  "apiKey": "_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

`auth.json` is in the root `.gitignore`, so it never gets committed.

### Option B — environment variables / `.env.local`

Set them in your shell:

```bash
export RALLY_SERVER=https://rally1.rallydev.com
export RALLY_API_KEY=_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

…or drop a gitignored `.env.local` in the widget folder:

```dotenv
RALLY_SERVER=https://rally1.rallydev.com
RALLY_API_KEY=_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Restart `npm run dev` after changing either source.** Vite reads them at startup.

## 3. Run the dev server

```bash
npm install
npm run dev
```

The terminal prints a URL (default `http://localhost:5175`). Open it in any browser.

The widget defaults to **mock data**. To switch to live Rally data, append `?live=true` to the URL. The mock data shows a sample "Platform Modernisation" dependency chain.

### What the DevHarness shows you

When you load the page from `localhost`, the SDK wraps your widget in `<DevHarness>` automatically. It renders a thin toolbar across the top of the page.

The toolbar is **never shown** outside `localhost` — in Rally and in production builds the harness is a transparent pass-through.

#### Project picker

Choose the project you want the widget scoped to. The harness updates `rallyContext.GlobalScope.Project`, and the next data fetch reflects the new scope.

#### Gear (settings)

Toggles `rallyContext.isEditMode`. The widget responds by rendering its `<EditModePanel>` with the two available settings:
- **Additional Filter** — a WSAPI query string to narrow the stories shown
- **Show isolated stories** — toggle to include stories with no in-scope dependency links

## 4. Using the widget

- **Hover** any story node for a tooltip showing full name, ScheduleState, story points, and blocked reason.
- **Double-click** any node to open the story's detail page in Rally in a new browser tab.
- **Keyboard**: Tab to navigate between nodes; press Enter or Space to follow the Rally link.
- Stories with no dependency relationships are hidden by default — enable "Show isolated stories" in settings to include them.

## 5. Deploy to Rally

```bash
npx widget-ai deploy
```

What it does, in order:

1. Runs `vite build` — emits a single `dist/app.js` IIFE with all styles inlined.
2. Wraps it in a minimal HTML doc that loads React from a CDN.
3. Reads `rally.config.json` for the widget name and target workspace.
4. Reads `auth.json` for credentials.
5. Hits the WSAPI Custom HTML Widget catalog and either creates a new Custom View or updates the existing one in place.
6. Prints the Rally URL where the deployed widget can be opened.

The created/updated view ID is written back into `rally.config.json` so subsequent deploys hit the same target.

## 6. Iterate

| Task | Command / action |
|------|----------------|
| Edit source | `src/App.tsx`, `src/components/SankeyChart.tsx` — Vite hot-reloads on save |
| Switch to a different project | DevHarness → Project picker |
| Open the settings UI | DevHarness → Gear button |
| Production build | `npm run build` |
| Mock build | `npm run build:mock` |
| TypeScript check | `npm run typecheck` |
| Deploy to Rally | `npx widget-ai deploy` |

---

## Reference

- [README](../README.md) — widget overview, features, settings, mock data scenario
- [Getting Started](./getting-started.md) — quick orientation
- [API Reference](./api-reference.md) — every component and hook
