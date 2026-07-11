/**
 * Fan the Monte-Carlo simulation across Web Workers (true parallelism, no UI
 * jank), then merge the partials. Samples are split into one chunk per worker,
 * each seeded distinctly so the streams are independent yet fully reproducible.
 *
 * The inline fallback runs the exact same chunk plan sequentially, so a run is
 * deterministic and identical whether or not Workers are available — only the
 * wall-clock differs.
 */

import {
	accumulate,
	finalize,
	mergePartials,
	type PartialResult,
} from "./monteCarlo";
import { mulberry32 } from "./prng";
import type { LevelUpStrategy, SimulationResult } from "./strategy";

export interface SimulationRunOptions {
	readonly samples: number;
	/** Base seed; chunk `i` uses `seed + i`. Defaults to 1. */
	readonly seed?: number;
	/** Worker/chunk count. Defaults to `hardwareConcurrency − 1`, capped at 16. */
	readonly workers?: number;
	/** Reports progress in `[0, 1]`. */
	readonly onProgress?: (fraction: number) => void;
	/** Cancels an in-flight run. */
	readonly signal?: AbortSignal;
}

interface Chunk {
	readonly samples: number;
	readonly seed: number;
}

/** Picks a sensible default worker count, leaving a core for the UI thread. */
export function defaultWorkerCount(): number {
	const cores =
		typeof navigator !== "undefined"
			? navigator.hardwareConcurrency
			: undefined;
	return Math.max(1, Math.min(16, (cores ?? 4) - 1));
}

/** Splits `samples` into `workers` chunks with distinct per-chunk seeds. */
function planChunks(
	samples: number,
	workers: number,
	baseSeed: number,
): Chunk[] {
	const count = Math.max(1, Math.min(workers, Math.max(1, samples)));
	const base = Math.floor(samples / count);
	const remainder = samples % count;
	return Array.from({ length: count }, (_, i) => ({
		samples: base + (i < remainder ? 1 : 0),
		seed: baseSeed + i,
	}));
}

/** Runs the whole simulation on the current thread (fallback / tests). */
export function runInline(
	strategy: LevelUpStrategy,
	options: SimulationRunOptions,
): SimulationResult {
	const chunks = planChunks(
		options.samples,
		options.workers ?? defaultWorkerCount(),
		options.seed ?? 1,
	);
	let completed = 0;
	const partials = chunks.map((chunk) => {
		const partial = accumulate(
			strategy,
			chunk.samples,
			mulberry32(chunk.seed),
			(done) => options.onProgress?.((completed + done) / options.samples),
		);
		completed += chunk.samples;
		return partial;
	});
	return finalize(mergePartials(partials));
}

/** Runs the simulation across Web Workers. Rejects with `AbortError` if cancelled. */
export function runWithWorkers(
	strategy: LevelUpStrategy,
	options: SimulationRunOptions,
): Promise<SimulationResult> {
	const chunks = planChunks(
		options.samples,
		options.workers ?? defaultWorkerCount(),
		options.seed ?? 1,
	);

	return new Promise<SimulationResult>((resolve, reject) => {
		const workers: Worker[] = [];
		const partials: PartialResult[] = new Array(chunks.length);
		const progress = new Array<number>(chunks.length).fill(0);
		let remaining = chunks.length;
		let settled = false;

		const cleanup = () => {
			for (const worker of workers) {
				worker.terminate();
			}
		};
		const fail = (error: unknown) => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(error);
		};

		if (options.signal) {
			if (options.signal.aborted) {
				fail(new DOMException("Aborted", "AbortError"));
				return;
			}
			options.signal.addEventListener("abort", () =>
				fail(new DOMException("Aborted", "AbortError")),
			);
		}

		chunks.forEach((chunk, index) => {
			const worker = new Worker(new URL("./sim.worker.ts", import.meta.url), {
				type: "module",
			});
			workers.push(worker);

			worker.onmessage = (event: MessageEvent) => {
				const message = event.data;
				if (message.type === "progress") {
					progress[index] = message.done;
					const done = progress.reduce((sum, value) => sum + value, 0);
					options.onProgress?.(done / options.samples);
				} else if (message.type === "done") {
					partials[index] = message.partial;
					worker.terminate();
					remaining--;
					if (remaining === 0 && !settled) {
						settled = true;
						resolve(finalize(mergePartials(partials)));
					}
				}
			};
			worker.onerror = fail;
			worker.postMessage({
				strategy,
				samples: chunk.samples,
				seed: chunk.seed,
			} satisfies {
				strategy: LevelUpStrategy;
				samples: number;
				seed: number;
			});
		});
	});
}

/**
 * Runs the simulation, using Web Workers when available and falling back to an
 * inline run otherwise (or if worker startup fails). Deterministic for a given
 * `(samples, seed, workers)`.
 */
export async function runSimulation(
	strategy: LevelUpStrategy,
	options: SimulationRunOptions,
): Promise<SimulationResult> {
	if (typeof Worker === "undefined") {
		return runInline(strategy, options);
	}
	try {
		return await runWithWorkers(strategy, options);
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw error;
		}
		return runInline(strategy, options);
	}
}
