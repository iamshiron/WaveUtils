# WaveUtils

[![CI](https://github.com/iamshiron/WaveUtils/actions/workflows/ci.yml/badge.svg)](https://github.com/iamshiron/WaveUtils/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/iamshiron/WaveUtils/actions/workflows/deploy.yml/badge.svg)](https://github.com/iamshiron/WaveUtils/actions/workflows/deploy.yml)
[![Live](https://img.shields.io/badge/live-iamshiron.github.io%2FWaveUtils-brightgreen)](https://iamshiron.github.io/WaveUtils/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A small collection of utilities and calculators for [Wuthering Waves](https://wutheringwaves.kurogames.com/en/main) — starting with an **echo roll-chance calculator** that tells you how likely you are to roll an echo matching a set of substat requirements.

> [!NOTE]
> **This is an early work-in-progress — treat it as a test bench / simulator, not a production-grade tool.**
> It has no backend and stores nothing; it exists to experiment with the roll math and the UI. More features are being actively worked on, so expect rough edges, incomplete pages, and occasional breaking changes.

## Features

- **Roll Calculator** — pick the substats you want on a 5★ echo and a minimum roll for each; see the probability (and the "1 in N" odds) update live. Values come from the game's actual, non-uniform roll distributions, and unspecified substats are treated as "don't care".
- **Shareable permalinks** — the full requirement set is encoded into a single compact URL token, so any configuration can be bookmarked or shared without a database.
- **Monte-Carlo simulator** — a type-safe echo generator used to cross-check the analytic probabilities.

## Live

👉 **https://iamshiron.github.io/WaveUtils/**

## Getting started

The [`@shiron/ui`](https://github.com/iamshiron/shiron-ui) component library is a git **submodule**, so clone recursively:

```bash
git clone --recurse-submodules https://github.com/iamshiron/WaveUtils.git
# already cloned without submodules?
git submodule update --init --recursive
```

Then install and run (requires [pnpm](https://pnpm.io) and Node 22+):

```bash
pnpm install
pnpm --filter @shiron/wave-utils-web dev     # http://localhost:60605
```

Build and test:

```bash
pnpm --filter @shiron/wave-utils-web build
pnpm --filter @shiron/wave-utils-web test
```

## Tech stack

React 19 · TypeScript · Vite · TanStack Router · Tailwind CSS v4 · [`@shiron/ui`](https://github.com/iamshiron/shiron-ui) (shadcn/Radix, submodule) · Biome · Vitest · pnpm workspaces · Nx.

The echo model, probability math, permalink codec and simulator live under [`app/src/lib/echoes`](./app/src/lib/echoes), and are covered by unit tests.

## Disclaimer

> [!IMPORTANT]
> Wuthering Waves is a trademark of [Kuro Games](https://www.kurogames.net/introduction). WaveUtils is an unofficial, fan-made project and is not affiliated with, endorsed by, or associated with Kuro Games. All game data and related names are the property of their respective owners.

## License

Released under the [MIT License](./LICENSE).
