/**
 * Web Worker entry point for the Monte-Carlo simulation. Runs one chunk of
 * samples off the main thread and posts progress plus a mergeable
 * {@link PartialResult} back. Kept intentionally thin — all the logic lives in
 * `monteCarlo.ts` so the worker and the inline fallback share identical code.
 */

/// <reference lib="webworker" />

import { accumulate } from "./monteCarlo";
import { mulberry32 } from "./prng";
import type { LevelUpStrategy } from "./strategy";

export interface SimWorkerRequest {
	readonly strategy: LevelUpStrategy;
	readonly samples: number;
	readonly seed: number;
}

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = (event: MessageEvent<SimWorkerRequest>) => {
	const { strategy, samples, seed } = event.data;
	const partial = accumulate(strategy, samples, mulberry32(seed), (done) => {
		worker.postMessage({ type: "progress", done });
	});
	worker.postMessage({ type: "done", partial });
};
