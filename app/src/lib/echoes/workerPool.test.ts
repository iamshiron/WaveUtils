import { describe, expect, it } from "vitest";
import type { LevelUpStrategy } from "./strategy";
import { defaultWorkerCount, runInline } from "./workerPool";

const STRATEGY: LevelUpStrategy = {
	version: 1,
	target: [{ substat: "critRate", min: 8.1 }],
	gates: [{ kind: "present", substat: "critRate" }, null, null, null, null],
};

describe("defaultWorkerCount", () => {
	it("is at least 1", () => {
		expect(defaultWorkerCount()).toBeGreaterThanOrEqual(1);
	});
});

describe("runInline", () => {
	it("is deterministic for a fixed (samples, seed, workers)", () => {
		const opts = { samples: 4000, seed: 7, workers: 4 };
		expect(runInline(STRATEGY, opts)).toEqual(runInline(STRATEGY, opts));
	});

	it("reports progress ending at 1", () => {
		let last = 0;
		runInline(STRATEGY, {
			samples: 4000,
			seed: 1,
			workers: 4,
			onProgress: (fraction) => {
				last = fraction;
			},
		});
		expect(last).toBeCloseTo(1, 6);
	});

	it("runs exactly `samples` echoes regardless of worker count", () => {
		for (const workers of [1, 3, 8]) {
			const result = runInline(STRATEGY, { samples: 5000, seed: 2, workers });
			expect(result.samples).toBe(5000);
			expect(result.kept + result.discarded).toBe(5000);
		}
	});

	it("splits an uneven sample count without dropping any", () => {
		// 1000 samples across 3 workers → 334 + 333 + 333.
		const result = runInline(STRATEGY, { samples: 1000, seed: 4, workers: 3 });
		expect(result.samples).toBe(1000);
	});
});
