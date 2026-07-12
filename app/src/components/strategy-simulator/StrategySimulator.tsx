import { Button } from "@shiron/ui/components/ui/button";
import { Progress } from "@shiron/ui/components/ui/progress";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@shiron/ui/components/ui/toggle-group";
import { useCallback, useRef, useState } from "react";
import {
	type Gate,
	type LevelUpStrategy,
	runSimulation,
	type SimulationResult,
	type SubstatRequirement,
} from "@/lib/echoes";
import { DesiredStats } from "./DesiredStats";
import { GateEditor } from "./GateEditor";
import { SimulationResults } from "./SimulationResults";

interface StrategySimulatorProps {
	readonly strategy: LevelUpStrategy;
	readonly onChange: (strategy: LevelUpStrategy) => void;
}

const SAMPLE_OPTIONS = [1000, 5000, 25000, 100000] as const;

function formatSamples(count: number): string {
	return count >= 1000 ? `${count / 1000}k` : String(count);
}

export function StrategySimulator({
	strategy,
	onChange,
}: StrategySimulatorProps) {
	const [samples, setSamples] = useState<number>(5000);
	const [running, setRunning] = useState(false);
	const [progress, setProgress] = useState(0);
	// Snapshot the strategy that produced the result, so the diagnostics stay in
	// sync with the numbers even if the user keeps editing gates afterwards.
	const [result, setResult] = useState<{
		result: SimulationResult;
		strategy: LevelUpStrategy;
	} | null>(null);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	function updateTarget(target: readonly SubstatRequirement[]) {
		onChange({ ...strategy, target: [...target] });
	}

	function updateGate(slot: number, gate: Gate | null) {
		onChange({
			...strategy,
			gates: strategy.gates.map((existing, i) =>
				i === slot ? gate : existing,
			),
		});
	}

	const run = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setRunning(true);
		setProgress(0);
		setError(null);
		try {
			const next = await runSimulation(strategy, {
				samples,
				seed: 1,
				onProgress: setProgress,
				signal: controller.signal,
			});
			setResult({ result: next, strategy });
		} catch (caught) {
			if (!(caught instanceof DOMException && caught.name === "AbortError")) {
				setError(caught instanceof Error ? caught.message : String(caught));
			}
		} finally {
			setRunning(false);
		}
	}, [strategy, samples]);

	return (
		<div className="space-y-8">
			<section className="space-y-3">
				<div>
					<h2 className="font-heading text-sm font-semibold text-muted-foreground">
						Desired stats — what “perfect” means
					</h2>
					<p className="text-xs text-muted-foreground">
						Grading yardstick only. Never used to keep or discard — just to tell
						whether the plan threw away echoes it should have kept.
					</p>
				</div>
				<DesiredStats target={strategy.target} onChange={updateTarget} />
			</section>

			<section className="space-y-3">
				<div>
					<h2 className="font-heading text-sm font-semibold text-muted-foreground">
						Level-up gates — keep or discard at each slot
					</h2>
					<p className="text-xs text-muted-foreground">
						After a slot’s substat is revealed, keep leveling only if its
						condition holds. “Present” means the stat appeared on any revealed
						slot so far.
					</p>
				</div>
				<div className="space-y-2">
					{strategy.gates.map((gate, slot) => (
						<GateEditor
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed 5 slots
							key={slot}
							slot={slot + 1}
							gate={gate}
							onChange={(next) => updateGate(slot, next)}
						/>
					))}
				</div>
			</section>

			<section className="space-y-3 border-t border-border pt-6">
				<div className="flex flex-wrap items-center gap-3">
					<span className="text-sm text-muted-foreground">
						Echoes to simulate
					</span>
					<ToggleGroup
						type="single"
						value={String(samples)}
						onValueChange={(value) => value && setSamples(Number(value))}
						variant="outline"
						size="sm"
					>
						{SAMPLE_OPTIONS.map((option) => (
							<ToggleGroupItem key={option} value={String(option)}>
								{formatSamples(option)}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
					<Button onClick={run} disabled={running} className="ml-auto">
						{running ? "Running…" : "Run simulation"}
					</Button>
				</div>
				{running && <Progress value={Math.round(progress * 100)} />}
				{error && (
					<p className="text-sm text-destructive">Simulation failed: {error}</p>
				)}
			</section>

			{result && (
				<SimulationResults result={result.result} strategy={result.strategy} />
			)}
		</div>
	);
}
