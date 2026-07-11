# WaveUtils

[![CI](https://github.com/iamshiron/WaveUtils/actions/workflows/ci.yml/badge.svg)](https://github.com/iamshiron/WaveUtils/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/iamshiron/WaveUtils/actions/workflows/deploy.yml/badge.svg)](https://github.com/iamshiron/WaveUtils/actions/workflows/deploy.yml)
[![Live](https://img.shields.io/badge/live-iamshiron.github.io%2FWaveUtils-brightgreen)](https://iamshiron.github.io/WaveUtils/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A small collection of utilities and calculators for [Wuthering Waves](https://wutheringwaves.kurogames.com/en/main) — an **echo roll-chance calculator** and a **level-up strategy simulator** that helps you waste fewer Tuners, less EXP and less Shell Credit getting the echoes you actually want.

> [!NOTE]
> **This is an early work-in-progress — treat it as a test bench / simulator, not a production-grade tool.**
> It has no backend and stores nothing; it exists to experiment with the roll math and the UI. More features are being actively worked on, so expect rough edges, incomplete pages, and occasional breaking changes.

## Features

- **Roll Calculator** — pick the substats you want on a 5★ echo and a minimum roll for each, and see the chance (and the "1 in N" odds) of an echo rolling with all of them, live. The numbers use the game's real roll rates; substats you don't pick are treated as "don't care".
- **Strategy Simulator** — write down *your own rules* for when to keep leveling an echo and when to trash it, then let the app try your plan out on a huge pile of random echoes and tell you what it really costs — and whether your rules are throwing away good echoes or burning mats on bad ones. [More below.](#the-strategy-simulator)
- **Shareable links** — your requirements (or your whole strategy) are packed straight into the page URL, so you can bookmark or share any setup. No account, no database, nothing saved on a server.

## The Strategy Simulator

Test a keep/discard rule for leveling echoes and see what it actually costs — no math required:

1. **Set your "perfect" echo** — the substats you're hunting for (e.g. Crit Rate, Crit DMG, ATK%), each with a minimum roll.
2. **Write your keep/discard rules, slot by slot** — for example: *after slot 1, keep only if it's Crit Rate **or** Crit DMG; after slot 3, keep only if it has **both** Crit Rate **and** Crit DMG.* You can combine conditions with **and / or / not**, exactly like you'd reason about it in-game.
3. **Hit Run.** The app plays your plan out over thousands of random echoes and reports the results.

### What it tells you (in plain terms)

- **Cost per perfect echo** — on average, how many Tuners, how much EXP and how much Shell Credit you'll burn to land *one* echo that hits all your wanted stats while following your rules. This is the number to minimize.
- **Too strict vs. too loose** — a simple grid splits every echo into four buckets: *got what you wanted*, *wasted a full level-up on a dud* (your rules were too loose), *threw away an echo that would've been perfect* (too strict), and *correctly tossed junk*. If the "threw away a winner" cell is glowing red, ease up your early rules; if "maxed a dud" is red, tighten them.
- **Vs. just maxing everything** — how much your plan saves (or wastes) compared to never discarding anything, so you can tell whether the rules are even worth it.
- **Where you discard** — which slot your rules usually bail at. Bailing earlier is much cheaper, since the EXP cost per level snowballs toward 25.

Tweak a rule, run it again, watch the cost drop. Everything runs right in your browser (spread across your CPU cores, so even 100,000 echoes finish in a moment) — nothing is uploaded.

> [!NOTE]
> This isn't meant to find a *mathematically optimal* plan — that would mean re-judging every echo after every single substat unlock, which is far too tedious to do by hand. The point is to help you build one simple, fixed set of rules you can follow at a glance while leveling — no crunching numbers or re-checking the odds on every echo — and to show you how good that set of rules actually is.
>
> It's all just statistics — there's no trick to rig the rolls or guarantee a good echo. And because a substat you're waiting on can always land on the very last slot, **no plan can ever avoid leveling some duds all the way to 25.** Seeing bad echoes slip through is expected, not a flaw in your rules — a good plan just keeps it rare.

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

The echo model, roll math, strategy evaluation, permalink codecs and the Monte-Carlo engine (parallelized with Web Workers) live under [`app/src/lib/echoes`](./app/src/lib/echoes), and are covered by unit tests.

## Disclaimer

> [!IMPORTANT]
> Wuthering Waves is a trademark of [Kuro Games](https://www.kurogames.net/introduction). WaveUtils is an unofficial, fan-made project and is not affiliated with, endorsed by, or associated with Kuro Games. All game data and related names are the property of their respective owners.

## License

Released under the [MIT License](./LICENSE).
