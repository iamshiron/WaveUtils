import { describe, expect, it } from "vitest";
import {
	addResources,
	cumulativeCostToStage,
	ECHO_MAX_STAGE,
	refund,
	STAGE_COSTS,
	scaleResources,
	subResources,
	ZERO_RESOURCES,
} from "./levelCosts";

describe("STAGE_COSTS", () => {
	it("has one entry per tuning stage", () => {
		expect(STAGE_COSTS).toHaveLength(ECHO_MAX_STAGE);
		expect(ECHO_MAX_STAGE).toBe(5);
	});

	it("uses the user-supplied marginal Echo EXP per stage", () => {
		expect(STAGE_COSTS.map((c) => c.echoExp)).toEqual([
			4400, 12100, 23100, 39500, 63500,
		]);
	});

	it("charges 10 Tuners per stage", () => {
		for (const cost of STAGE_COSTS) {
			expect(cost.tuners).toBe(10);
		}
	});

	it("charges 0.1 Shell Credit per EXP plus a 2000 tune fee", () => {
		for (const cost of STAGE_COSTS) {
			expect(cost.shellCredit).toBeCloseTo(cost.echoExp * 0.1 + 2000, 6);
		}
	});

	it("is strictly increasing in EXP (the exponential curve)", () => {
		for (let i = 1; i < STAGE_COSTS.length; i++) {
			expect(STAGE_COSTS[i].echoExp).toBeGreaterThan(
				STAGE_COSTS[i - 1].echoExp,
			);
		}
	});
});

describe("cumulativeCostToStage", () => {
	it("is zero at stage 0", () => {
		expect(cumulativeCostToStage(0)).toEqual(ZERO_RESOURCES);
	});

	it("matches the disclosed cumulative EXP breakpoints", () => {
		expect(cumulativeCostToStage(1).echoExp).toBe(4400);
		expect(cumulativeCostToStage(2).echoExp).toBe(16500);
		expect(cumulativeCostToStage(3).echoExp).toBe(39600);
		expect(cumulativeCostToStage(4).echoExp).toBe(79100);
		expect(cumulativeCostToStage(5).echoExp).toBe(142600);
	});

	it("totals 142,600 EXP / 50 Tuners / 24,260 Shell for a full 5★", () => {
		const full = cumulativeCostToStage(ECHO_MAX_STAGE);
		expect(full.echoExp).toBe(142600);
		expect(full.tuners).toBe(50);
		expect(full.shellCredit).toBeCloseTo(24260, 6);
	});

	it("clamps out-of-range stages", () => {
		expect(cumulativeCostToStage(-1)).toEqual(ZERO_RESOURCES);
		expect(cumulativeCostToStage(99)).toEqual(
			cumulativeCostToStage(ECHO_MAX_STAGE),
		);
	});
});

describe("refund", () => {
	it("returns 30% of tuners (floored) and no shell credit", () => {
		const full = cumulativeCostToStage(ECHO_MAX_STAGE);
		const back = refund(full);
		expect(back.tuners).toBe(Math.floor(50 * 0.3)); // 15
		expect(back.shellCredit).toBe(0);
	});

	it("returns 75% of EXP floored to whole Sealed Tubes (multiple of 500)", () => {
		// 10,000 spent → 7,500 refundable → already a multiple of 500.
		expect(refund({ echoExp: 10000, tuners: 0, shellCredit: 0 }).echoExp).toBe(
			7500,
		);
		// 4,400 spent → 3,300 refundable → floored to 3,000 (loses 300 sub-tube remainder).
		expect(refund({ echoExp: 4400, tuners: 0, shellCredit: 0 }).echoExp).toBe(
			3000,
		);
	});

	it("never refunds more than was spent", () => {
		const full = cumulativeCostToStage(ECHO_MAX_STAGE);
		const back = refund(full);
		expect(back.echoExp).toBeLessThanOrEqual(full.echoExp);
		expect(back.tuners).toBeLessThanOrEqual(full.tuners);
	});
});

describe("resource vector math", () => {
	it("adds, subtracts and scales component-wise", () => {
		const a = { echoExp: 100, tuners: 2, shellCredit: 30 };
		const b = { echoExp: 40, tuners: 1, shellCredit: 10 };
		expect(addResources(a, b)).toEqual({
			echoExp: 140,
			tuners: 3,
			shellCredit: 40,
		});
		expect(subResources(a, b)).toEqual({
			echoExp: 60,
			tuners: 1,
			shellCredit: 20,
		});
		expect(scaleResources(a, 2)).toEqual({
			echoExp: 200,
			tuners: 4,
			shellCredit: 60,
		});
	});
});
