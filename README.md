# Premier League Stats

A browser-based stats dashboard for the 2025/2026 Premier League season. Upload your match and goal data as CSV files and explore interactive tables, visualizations, and predictions — no backend required.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Export your data

Open `PremStats.xlsx` in Excel and export two sheets as CSV (File → Save As → CSV UTF-8):

- `Matches` sheet → save as `matches.csv`
- `Goals` sheet → save as `goals.csv`

### 3. Run the app

```bash
npm run dev
```

Open the localhost URL shown in your terminal, then upload `matches.csv` and `goals.csv` on the landing screen.

## Pages

| Page | Route | Description |
|---|---|---|
| League Table | `/` | Sortable standings with xG, xPts, form pills, and three charts |
| Scorers | `/scorers` | Goal and assist leaderboards with player click-through drawer |
| Team | `/team/:name` | Per-team dashboard across Overview, Form, Matches, Goals, and Set Piece tabs |
| Trends | `/trends` | League-wide charts across gameweeks (goals, discipline, home advantage) |
| Progression | `/progression` | Cumulative metrics per team — table, line chart, and bump chart views |
| Predict | `/predict` | Match result predictor using three models — **Beta** |

## Charts & Visualizations

**League Table**
- xPts vs Points scatter (over/under-performers)
- Team form heatmap (W/D/L across all gameweeks)
- Attack vs Defense quadrant (xG/game vs xGA/game)

**Scorers**
- xG vs Goals scatter (finishing quality)
- xGOT − xG horizontal bar (shot quality after contact)
- Goal-time density small multiples (when top scorers strike)
- Assist → Scorer Sankey diagram (on-field partnerships)

**Team**
- Radar vs league average (8 normalized axes)
- Home vs Away profile (PPG, xG, xGA, possession)
- Inside vs Outside box goal share (donuts, For and Against)
- Cumulative xG vs Goals line (finishing luck over the season)
- Half-by-half xG split (slow/fast starters by gameweek)
- Possession vs Result scatter (per match)
- Goal-minute histogram (when goals are scored/conceded)
- Set piece breakdowns (Corner / Free Kick / Throw-in, with opener / half / home-away splits)

**Trends**
- Goals and xG per gameweek
- Home/Draw/Away win share over time
- Goal situation mix (stacked area)
- Discipline (yellows/reds per match)
- "Scored first" win-rate per team

**Progression**
- Cumulative Points / Goals Scored / Goals Conceded / xG / xGA — as table, line chart, or bump chart

## Prediction Models (Beta)

The `/predict` page lets you pick a Home and Away team and compares three models side-by-side:

| Model | Output |
|---|---|
| **Poisson (xG-based)** | H/D/A %, expected goals, top-5 scorelines, O/U 2.5, BTTS |
| **Dixon–Coles** | Same as Poisson + low-score correction + time decay |
| **Elo** | H/D/A % only (no scoreline modelling) |

Predictions are based on a single partial season (~30 matches per team). Treat as directional.

## Tech Stack

- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) + TypeScript
- [Papa Parse](https://www.papaparse.com/) — CSV parsing
- [Recharts](https://recharts.org/) — charts
- [TanStack Table](https://tanstack.com/table) — sortable tables
- [Zustand](https://zustand-demo.pmnd.rs/) — state management
- [d3-array](https://github.com/d3/d3-array) — statistical helpers (KDE for density plots)
- [fmin](https://github.com/benfred/fmin) — Dixon–Coles MLE optimisation

## Data Persistence

Parsed data is saved to `localStorage` so a page reload does not require re-uploading. Use the **Clear data** button in the nav to reset and upload new files.

## Build for Deployment

```bash
npm run build
```

The `dist/` folder is a self-contained static site — deploy to Vercel, Netlify, or GitHub Pages with no configuration changes needed.
