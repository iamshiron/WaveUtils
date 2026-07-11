import { describe, expect, it } from "vitest";
import { defaultStrategy, emptyGates, STRATEGY_SLOTS } from "./strategy";

describe("emptyGates", () => {
	it("produces one null gate per slot", () => {
		const gates = emptyGates();
		expect(gates).toHaveLength(STRATEGY_SLOTS);
		expect(gates.every((gate) => gate === null)).toBe(true);
	});
});

describe("defaultStrategy", () => {
	it("is a blank, versioned, JSON-serializable plan", () => {
		const strategy = defaultStrategy();
		expect(strategy.version).toBe(1);
		expect(strategy.target).toEqual([]);
		expect(strategy.gates).toHaveLength(STRATEGY_SLOTS);
		// round-trips through JSON unchanged (crosses worker/URL boundaries cleanly)
		expect(JSON.parse(JSON.stringify(strategy))).toEqual(strategy);
	});
});
