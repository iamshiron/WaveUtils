import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { RollCalculator } from "@/components/roll-calculator/RollCalculator";

export const Route = createFileRoute("/roll-calculator")({
	component: RollCalculatorPage,
});

function RollCalculatorPage() {
	return (
		<AppShell>
			<div className="space-y-6">
				<div className="space-y-2">
					<h1 className="font-heading text-3xl font-bold tracking-tight">
						Roll Calculator
					</h1>
					<p className="text-muted-foreground">
						Pick the substats you want on a 5★ echo and the minimum roll for
						each. The chance updates live as you go — unspecified substats are
						treated as “don’t care”.
					</p>
				</div>
				<RollCalculator />
			</div>
		</AppShell>
	);
}
