import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	return (
		<AppShell>
			<div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
				<h1 className="font-heading text-5xl font-bold tracking-tight">
					<span className="text-primary">WaveUtils</span>
				</h1>
				<p className="mx-auto max-w-md text-muted-foreground">
					A blank starting point. Start building here.
				</p>
			</div>
		</AppShell>
	);
}
