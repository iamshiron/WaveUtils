import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import {
	calculateRollChance,
	getSubstat,
	type SubstatRequirement,
} from "@/lib/echoes";

export const Route = createFileRoute("/roll-calculator")({
	component: RollCalculatorPage,
});

// Placeholder example until the interactive requirement builder lands.
const EXAMPLE_REQUIREMENTS: readonly SubstatRequirement[] = [
	{ substat: "critDmg", min: 16.2 },
	{ substat: "critRate", min: 8.1 },
	{ substat: "atkPercent", min: 7.9 },
];

function formatPercent(probability: number): string {
	if (probability <= 0) {
		return "0%";
	}
	if (probability < 0.01) {
		return `${(probability * 100).toFixed(4)}%`;
	}
	return `${(probability * 100).toFixed(2)}%`;
}

function formatOdds(probability: number): string {
	if (probability <= 0) {
		return "impossible";
	}
	return `1 in ${Math.round(1 / probability).toLocaleString()}`;
}

function RollCalculatorPage() {
	const result = calculateRollChance(EXAMPLE_REQUIREMENTS);

	return (
		<AppShell>
			<div className="space-y-6">
				<div className="space-y-2">
					<h1 className="font-heading text-3xl font-bold tracking-tight">
						Roll Calculator
					</h1>
					<p className="text-muted-foreground">
						Define the substats you want on an echo and see how likely it is to
						roll one that matches. The interactive builder is coming soon — below
						is a worked example.
					</p>
				</div>

				<div className="rounded-xl border border-border p-5">
					<h2 className="mb-3 font-heading text-sm font-semibold text-muted-foreground">
						Example requirement · 5★ echo, 5 substat slots
					</h2>
					<ul className="mb-4 space-y-1 text-sm">
						{result.perRequirement.map((req) => {
							const definition = getSubstat(req.substat);
							return (
								<li key={req.substat} className="flex justify-between gap-4">
									<span>
										{definition.label} ≥ {req.min}
										{definition.isPercent ? "%" : ""}
									</span>
									<span className="tabular-nums text-muted-foreground">
										value chance {formatPercent(req.valueProbability)}
									</span>
								</li>
							);
						})}
					</ul>
					<div className="flex items-baseline justify-between border-t border-border pt-4">
						<span className="font-heading text-2xl font-bold text-primary">
							{formatPercent(result.probability)}
						</span>
						<span className="text-sm text-muted-foreground">
							≈ {formatOdds(result.probability)}
						</span>
					</div>
				</div>
			</div>
		</AppShell>
	);
}
