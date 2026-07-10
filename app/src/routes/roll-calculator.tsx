import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { RollCalculator } from "@/components/roll-calculator/RollCalculator";
import {
	decodeRequirements,
	encodeRequirements,
	type SubstatRequirement,
} from "@/lib/echoes";

interface RollCalculatorSearch {
	/** Compact token holding the full requirement list (see `encodeRequirements`). */
	readonly r?: string;
}

export const Route = createFileRoute("/roll-calculator")({
	validateSearch: (search: Record<string, unknown>): RollCalculatorSearch => ({
		r:
			typeof search.r === "string" && search.r.length > 0 ? search.r : undefined,
	}),
	component: RollCalculatorPage,
});

function RollCalculatorPage() {
	const { r } = Route.useSearch();
	const navigate = Route.useNavigate();

	const requirements = decodeRequirements(r);

	function handleChange(next: readonly SubstatRequirement[]) {
		const token = encodeRequirements(next);
		navigate({
			search: token.length > 0 ? { r: token } : {},
			replace: true,
		});
	}

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
						treated as “don’t care”. Your selection is saved in the URL, so you
						can bookmark or share it as a permalink.
					</p>
				</div>
				<RollCalculator requirements={requirements} onChange={handleChange} />
			</div>
		</AppShell>
	);
}
