import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { StrategySimulator } from "@/components/strategy-simulator/StrategySimulator";
import type { LevelUpStrategy } from "@/lib/echoes";
import {
	decodeStrategy,
	encodeStrategy,
	type StrategySearch,
} from "@/lib/echoes/strategyPermalink";

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const Route = createFileRoute("/strategy-simulator")({
	validateSearch: (search: Record<string, unknown>): StrategySearch => ({
		target: readString(search.target),
		gate0: readString(search.gate0),
		gate1: readString(search.gate1),
		gate2: readString(search.gate2),
		gate3: readString(search.gate3),
		gate4: readString(search.gate4),
	}),
	component: StrategySimulatorPage,
});

function StrategySimulatorPage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const strategy = decodeStrategy(search);

	function handleChange(next: LevelUpStrategy) {
		navigate({ search: encodeStrategy(next), replace: true });
	}

	return (
		<AppShell wide>
			<div className="space-y-6">
				<div className="space-y-2">
					<h1 className="font-heading text-3xl font-bold tracking-tight">
						Level-Up Strategy Simulator
					</h1>
					<p className="text-muted-foreground">
						Define a keep/discard plan for leveling 5★ echoes, then Monte-Carlo
						it against the real roll odds to see the resources spent per perfect
						echo — and whether your plan is too aggressive or too lenient. Your
						plan is saved in the URL; the simulation runs entirely in your
						browser across multiple threads.
					</p>
				</div>
				<StrategySimulator strategy={strategy} onChange={handleChange} />
			</div>
		</AppShell>
	);
}
