/**
 * mulberry32 — a tiny, fast, seedable PRNG. Used so Monte-Carlo runs are
 * reproducible and each Web Worker can draw an independent, non-correlated
 * stream from a distinct seed. Plugs into the existing {@link RandomSource}
 * injection point on `rollEcho`.
 */

import type { RandomSource } from "./simulate";

/** Creates a deterministic uniform `[0, 1)` source from a 32-bit seed. */
export function mulberry32(seed: number): RandomSource {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
