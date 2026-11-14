# Token Radar — radar-3

Every protocol in the DefiLlama snapshot that records no token, ranked by what its
launch would be worth, with a farm plan for each one. Built for make.fun's
token-radar-01 bounty.

## The model

`implied = TVL × fitted multiple × growth × maturity × breadth`

- **Fitted multiple**: the median market-cap-to-TVL ratio of the traded protocols in
  the same category (at least 3 comparables, else the global median), clamped to
  0.05–1.20×. Where a category has 8+ traded comparables, the multiple is tilted for
  size by the category's own log-log slope, shrunk toward the global slope and
  clamped hard (exponent ±0.15, factor 0.7–1.4×).
- **Growth**: 7-day TVL change clamped to −50…+100% and weighted 0.6.
- **Maturity**: 0.7–1.2 over 1,095 days without a token (365 when unknown).
- **Breadth**: +0.02 per extra chain, up to 4.
- **Range**: every row carries [implied / 2, implied × 2].
- **Readiness**: a 0–100 farm-now signal from growth, maturity and breadth.

The global fit is log10(mcap) = 3.02 + 0.52 × log10(TVL), R² 0.19 over 128 traded
protocols — size alone explains a fifth of the variance, which is why the board
prices by category instead of by the curve. A leave-one-out backtest over the 128
traded protocols gives a median pricing error near 93% with about six in ten inside
2×; the dashboard publishes those numbers and the range that follows from them.

## The board

198 rows: the 40 watchlist protocols at or above the $50M floor, plus every other
rankable pre-token protocol below it. Wrapped, staked and bridged products are set
aside, never ranked; the 24 biggest live-token protocols are shown apart with the
market's own values. Each row's farm plan is six steps, shaped by the protocol's
mechanism (lending, DEX, vault, bridge, perps, staking, …) with a cost and a time
per step and totals up front.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

Writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json`
into the output directory. Node 22, standard library only; deterministic — two runs
are byte-identical.

## Files

- `main.ts` — the entrypoint: reads the snapshot, scores the board, writes the outputs.
- `lib/model.ts` — the radar-3 model, the farm plans and the board checks.
- `dashboard/` — `index.html`, `app.css`, `app.js`: the page the screenshots show.
- `screenshots/` — the board, a detail view and a filtered view, 1280×800 JPEG.
- `vendor/makefun-board.ts` — the kit's dossier library, copied byte for byte.
