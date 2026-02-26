export function formatCurrency(amountCents: number, currency = "usd"): string {
	const amount = amountCents / 100;
	const symbol = currency.toLowerCase() === "usd" ? "$" : currency.toUpperCase();
	return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatUsageBar(used: number, total: number, width = 10): string {
	if (total <= 0) return "unlimited";
	const ratio = Math.min(used / total, 1);
	const filled = Math.round(ratio * width);
	const empty = width - filled;
	const bar = "█".repeat(filled) + "░".repeat(empty);
	const pct = Math.round(ratio * 100);
	return `${bar} ${pct}%`;
}

export function formatNumber(n: number): string {
	return n.toLocaleString("en-US");
}

export function formatUsageRatio(used: number, total: number): string {
	if (total <= 0) return `${formatNumber(used)} / unlimited`;
	return `${formatNumber(used)} / ${formatNumber(total)}`;
}

export function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diffMs = timestamp - now;
	const absDiffMs = Math.abs(diffMs);
	const isFuture = diffMs > 0;

	const minutes = Math.floor(absDiffMs / 60_000);
	const hours = Math.floor(absDiffMs / 3_600_000);
	const days = Math.floor(absDiffMs / 86_400_000);

	let timeStr: string;
	if (days > 0) {
		timeStr = `${days} day${days === 1 ? "" : "s"}`;
	} else if (hours > 0) {
		timeStr = `${hours} hour${hours === 1 ? "" : "s"}`;
	} else {
		timeStr = `${minutes} minute${minutes === 1 ? "" : "s"}`;
	}

	return isFuture ? `in ${timeStr}` : `${timeStr} ago`;
}

export function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
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

export function getUsageEmoji(used: number, total: number): string {
	if (total <= 0) return "∞";
	const pct = (used / total) * 100;
	if (pct >= 100) return "🚨";
	if (pct >= 80) return "⚠️";
	if (pct >= 50) return "📊";
	return "✅";
}

export function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, maxLen: number): string {
	if (str.length <= maxLen) return str;
	return `${str.slice(0, maxLen - 1)}…`;
}
