import { Card } from "@shiron/ui/components/ui/card";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { ResourceVector, SimulationResult } from "@/lib/echoes";

const FULL_ECHO_EXP = 142600;

function isFiniteVector(v: ResourceVector): boolean {
	return Number.isFinite(v.echoExp);
}

function round(n: number): string {
	return Math.round(n).toLocaleString();
}

function pct(fraction: number): string {
	return `${(fraction * 100).toFixed(1)}%`;
}

/** Compact "EXP · Tuners · Shell" resource readout. */
function Resources({ value }: { value: ResourceVector }) {
	if (!isFiniteVector(value)) {
		return <span className="text-muted-foreground">never</span>;
	}
	return (
		<span className="tabular-nums">
			{round(value.echoExp)}{" "}
			<span className="text-xs text-muted-foreground">EXP</span> ·{" "}
			{round(value.tuners)}{" "}
			<span className="text-xs text-muted-foreground">Tuners</span> ·{" "}
			{round(value.shellCredit)}{" "}
			<span className="text-xs text-muted-foreground">Shell</span>
		</span>
	);
}

function Stat({
	label,
	children,
	hint,
}: {
	label: string;
	children: React.ReactNode;
	hint?: string;
}) {
	return (
		<div>
			<div className="text-xs text-muted-foreground">{label}</div>
			<div className="mt-0.5 font-medium tabular-nums">{children}</div>
			{hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
		</div>
	);
}

export function SimulationResults({ result }: { result: SimulationResult }) {
	const discardData = result.discardsByStage.map((count, index) => ({
		slot: `Slot ${index + 1}`,
		count,
	}));

	// Trim trailing empty histogram bins for a tidy chart.
	let lastNonZero = 0;
	result.costHistogram.forEach((bin, index) => {
		if (bin.count > 0) lastNonZero = index;
	});
	const histData = result.costHistogram
		.slice(0, lastNonZero + 1)
		.map((bin) => ({
			echoes: Math.round(bin.bucket / FULL_ECHO_EXP),
			count: bin.count,
		}));

	const savings =
		isFiniteVector(result.trueCostPerPerfect) &&
		isFiniteVector(result.baselineCostPerPerfect) &&
		result.baselineCostPerPerfect.echoExp > 0
			? 1 -
				result.trueCostPerPerfect.echoExp /
					result.baselineCostPerPerfect.echoExp
			: null;

	return (
		<div className="space-y-4">
			{/* Headline */}
			<Card className="p-4">
				<div className="text-xs text-muted-foreground">
					Net resources per perfect echo
				</div>
				<div className="mt-1 font-heading text-2xl font-bold text-primary">
					<Resources value={result.trueCostPerPerfect} />
				</div>
				<div className="mt-1 text-sm text-muted-foreground">
					{Number.isFinite(result.echoesPerPerfect)
						? `≈ ${round(result.echoesPerPerfect)} echoes farmed per perfect one`
						: "no perfect echo was ever kept — loosen the plan or lower the target"}
					{savings !== null && (
						<>
							{" · "}
							<span
								className={savings >= 0 ? "text-primary" : "text-destructive"}
							>
								{savings >= 0 ? "saves " : "costs "}
								{pct(Math.abs(savings))} vs. leveling everything
							</span>
						</>
					)}
				</div>
			</Card>

			{/* Key rates */}
			<Card className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
				<Stat
					label="Kept"
					hint={`${round(result.kept)} / ${round(result.samples)}`}
				>
					{pct(result.keptRate)}
				</Stat>
				<Stat label="Perfect keeps" hint="kept AND on-target">
					{round(result.perfectKeeps)}
				</Stat>
				<Stat label="Avg slot reached" hint="before keep/discard">
					{result.avgStageReached.toFixed(2)}
				</Stat>
				<Stat label="Baseline perfect rate" hint="if you never discard">
					{pct(result.baselinePerfectRate)}
				</Stat>
			</Card>

			{/* Confusion matrix */}
			<Card className="p-4">
				<div className="mb-2 text-sm font-semibold">
					Plan vs. “perfect” outcomes
				</div>
				<div className="grid grid-cols-[auto_1fr_1fr] gap-px overflow-hidden rounded-md border border-border bg-border text-sm">
					<div className="bg-card p-2" />
					<div className="bg-card p-2 text-center text-xs font-medium text-muted-foreground">
						would be perfect
					</div>
					<div className="bg-card p-2 text-center text-xs font-medium text-muted-foreground">
						not perfect
					</div>

					<div className="flex items-center bg-card p-2 text-xs font-medium text-muted-foreground">
						kept
					</div>
					<div className="bg-card p-2 text-center">
						<div className="font-semibold tabular-nums text-primary">
							{round(result.perfectKeeps)}
						</div>
						<div className="text-[11px] text-muted-foreground">
							what you wanted
						</div>
					</div>
					<div className="bg-card p-2 text-center">
						<div className="font-semibold tabular-nums">
							{round(result.imperfectKeeps)}
						</div>
						<div className="text-[11px] text-muted-foreground">
							too lenient — maxed a dud
						</div>
					</div>

					<div className="flex items-center bg-card p-2 text-xs font-medium text-muted-foreground">
						discarded
					</div>
					<div className="bg-card p-2 text-center">
						<div className="font-semibold tabular-nums text-destructive">
							{round(result.perfectButDiscarded)}
						</div>
						<div className="text-[11px] text-muted-foreground">
							too aggressive — threw away a winner
						</div>
					</div>
					<div className="bg-card p-2 text-center">
						<div className="font-semibold tabular-nums">
							{round(result.correctDiscards)}
						</div>
						<div className="text-[11px] text-muted-foreground">
							correct cull
						</div>
					</div>
				</div>
			</Card>

			{/* Cost distribution */}
			<Card className="grid gap-4 p-4 sm:grid-cols-3">
				<Stat label="Cheapest perfect echo" hint="lucky streak">
					<Resources value={result.costPerPerfect.min} />
				</Stat>
				<Stat
					label="Average"
					hint={`${round(result.costPerPerfect.count)} acquisitions`}
				>
					<Resources value={result.costPerPerfect.avg} />
				</Stat>
				<Stat label="Most expensive" hint="unlucky streak">
					<Resources value={result.costPerPerfect.max} />
				</Stat>
			</Card>

			{/* Charts */}
			<div className="grid gap-4 lg:grid-cols-2">
				<Card className="p-4">
					<div className="mb-2 text-sm font-semibold">
						Where the plan discards
					</div>
					<div className="h-48">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={discardData}>
								<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
								<XAxis
									dataKey="slot"
									tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
								/>
								<YAxis
									tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
								/>
								<Tooltip
									contentStyle={{
										background: "var(--popover)",
										border: "1px solid var(--border)",
										borderRadius: 8,
										fontSize: 12,
									}}
								/>
								<Bar
									dataKey="count"
									radius={[4, 4, 0, 0]}
									fill="var(--primary)"
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</Card>

				<Card className="p-4">
					<div className="mb-2 text-sm font-semibold">
						Cost per perfect echo (in full-echo EXP)
					</div>
					<div className="h-48">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={histData}>
								<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
								<XAxis
									dataKey="echoes"
									tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
								/>
								<YAxis
									tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
								/>
								<Tooltip
									contentStyle={{
										background: "var(--popover)",
										border: "1px solid var(--border)",
										borderRadius: 8,
										fontSize: 12,
									}}
								/>
								<Bar
									dataKey="count"
									radius={[4, 4, 0, 0]}
									fill="var(--primary)"
								>
									{histData.map((entry) => (
										<Cell key={entry.echoes} />
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</Card>
			</div>
		</div>
	);
}
