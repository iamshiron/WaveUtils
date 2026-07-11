/**
 * Bridges the general {@link Gate} tree and the editor's bounded "AND of
 * OR-groups" form. A slot gate is shown as a list of groups AND-ed together;
 * each group is an OR of substats with an optional NOT (blacklist). This covers
 * every example the user gave while staying a flat, simple UI. Gates that don't
 * fit the canonical shape (e.g. a hand-crafted deeply-nested URL) are flattened
 * best-effort on load.
 */

import type { Gate, SubstatId } from "@/lib/echoes";

/** One AND-clause: OR of the listed substats, optionally negated. */
export interface OrGroup {
	readonly negate: boolean;
	readonly anyOf: readonly SubstatId[];
}

function groupToGate(group: OrGroup): Gate | null {
	if (group.anyOf.length === 0) {
		return null;
	}
	const base: Gate =
		group.anyOf.length === 1
			? { kind: "present", substat: group.anyOf[0] }
			: {
					kind: "or",
					conditions: group.anyOf.map((substat) => ({
						kind: "present",
						substat,
					})),
				};
	return group.negate ? { kind: "not", condition: base } : base;
}

/** Compiles editor groups into a gate (`null` when there are no usable groups). */
export function groupsToGate(groups: readonly OrGroup[]): Gate | null {
	const gates = groups
		.map(groupToGate)
		.filter((gate): gate is Gate => gate !== null);
	if (gates.length === 0) {
		return null;
	}
	if (gates.length === 1) {
		return gates[0];
	}
	return { kind: "and", conditions: gates };
}

function gateToGroup(gate: Gate): OrGroup | null {
	switch (gate.kind) {
		case "present":
			return { negate: false, anyOf: [gate.substat] };
		case "or": {
			const anyOf = gate.conditions
				.filter((child) => child.kind === "present")
				.map((child) => (child as { substat: SubstatId }).substat);
			return anyOf.length > 0 ? { negate: false, anyOf } : null;
		}
		case "not": {
			const inner = gateToGroup(gate.condition);
			return inner ? { negate: true, anyOf: inner.anyOf } : null;
		}
		default:
			return null;
	}
}

/** Decomposes a gate into editor groups. */
export function gateToGroups(gate: Gate | null): OrGroup[] {
	if (!gate) {
		return [];
	}
	if (gate.kind === "and") {
		return gate.conditions
			.map(gateToGroup)
			.filter((group): group is OrGroup => group !== null);
	}
	const single = gateToGroup(gate);
	return single ? [single] : [];
}
