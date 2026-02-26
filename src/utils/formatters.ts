export function formatNumber(n: number): string {
	return n.toLocaleString("en-US");
}

const DURATION_MS: Record<string, number> = {
	h: 3_600_000,
	d: 86_400_000,
	w: 604_800_000,
	m: 2_592_000_000,
};

export function parseDuration(input: string): number | null {
	const match = input.match(/^(\d+)(h|d|w|m)$/);
	if (!match) return null;

	const value = Number.parseInt(match[1], 10);
	const multiplier = DURATION_MS[match[2]];
	return multiplier ? value * multiplier : null;
}
