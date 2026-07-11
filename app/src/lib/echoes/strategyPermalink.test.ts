import { describe, expect, it } from "vitest";
import type { Gate, LevelUpStrategy } from "./strategy";
import {
	decodeGate,
	decodeStrategy,
	encodeGate,
	encodeStrategy,
} from "./strategyPermalink";
import type { SubstatId } from "./substats";

const present = (substat: SubstatId): Gate => ({ kind: "present", substat });
const and = (...conditions: Gate[]): Gate => ({ kind: "and", conditions });
const or = (...conditions: Gate[]): Gate => ({ kind: "or", conditions });
const not = (condition: Gate): Gate => ({ kind: "not", condition });

const STRATEGY: LevelUpStrategy = {
	version: 1,
	target: [
		{ substat: "critRate", min: 8.1 },
		{ substat: "critDmg", min: 16.2 },
		{ substat: "atkPercent", min: 7.9 },
	],
	gates: [
		or(present("critRate"), present("critDmg")),
		null,
		and(present("critRate"), present("critDmg")),
		null,
		and(
			present("critRate"),
			present("critDmg"),
			or(present("atkPercent"), present("resonanceLiberation")),
		),
	],
};

describe("encodeGate / decodeGate", () => {
	it("round-trips each node type, including nesting and NOT", () => {
		const gates: Gate[] = [
			present("critDmg"),
			or(present("critRate"), present("critDmg")),
			and(present("critRate"), present("critDmg")),
			not(present("def")),
			and(present("critRate"), or(present("atkPercent"), not(present("hp")))),
		];
		for (const gate of gates) {
			expect(decodeGate(encodeGate(gate))).toEqual(gate);
		}
	});

	it("encodes null / empty as an empty token", () => {
		expect(encodeGate(null)).toBe("");
		expect(decodeGate("")).toBeNull();
		expect(decodeGate(undefined)).toBeNull();
	});

	it("produces URL-safe characters only", () => {
		expect(encodeGate(STRATEGY.gates[4])).toMatch(/^[0-9a-z&|!]*$/);
	});

	it("returns null on malformed tokens instead of throwing", () => {
		expect(decodeGate("p")).toBeNull(); // dangling present
		expect(decodeGate("&2p0")).toBeNull(); // and promised 2 children, got 1
		expect(decodeGate("x")).toBeNull(); // unknown opcode
		expect(decodeGate("pz")).toBeNull(); // substat index out of range
	});
});

describe("encodeStrategy / decodeStrategy", () => {
	it("round-trips the full worked example", () => {
		expect(decodeStrategy(encodeStrategy(STRATEGY))).toEqual(STRATEGY);
	});

	it("omits empty gates and empty target from the params", () => {
		const search = encodeStrategy(STRATEGY);
		expect(search.gate1).toBeUndefined();
		expect(search.gate3).toBeUndefined();
		expect(search.target).toBeDefined();
		expect(search.gate0).toBeDefined();
	});

	it("decodes an empty search into a blank 5-slot strategy", () => {
		const strategy = decodeStrategy({});
		expect(strategy.target).toEqual([]);
		expect(strategy.gates).toEqual([null, null, null, null, null]);
	});

	it("keeps slot alignment when middle gates are absent", () => {
		const decoded = decodeStrategy(encodeStrategy(STRATEGY));
		expect(decoded.gates[1]).toBeNull();
		expect(decoded.gates[2]).toEqual(STRATEGY.gates[2]);
		expect(decoded.gates[4]).toEqual(STRATEGY.gates[4]);
	});
});
