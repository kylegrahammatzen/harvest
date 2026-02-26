import type { CardChild } from "chat";
import { Card, CardText as Text } from "chat";
import { formatNumber, formatUsageBar, formatUsageRatio, getUsageEmoji } from "@/utils/formatters";

type FeatureUsage = {
	featureId: string;
	featureName?: string;
	usage: number;
	includedUsage: number;
	balance: number | null;
	unlimited?: boolean;
	nextResetAt?: number | null;
};

type UsageCardProps = {
	customerId: string;
	customerName?: string | null;
	features: FeatureUsage[];
	range?: string;
};

export function UsageCard({ customerId, customerName, features, range }: UsageCardProps) {
	const children: CardChild[] = [];

	if (range) {
		children.push(Text(`_Period: ${range}_`));
	}

	for (const f of features) {
		const usageStr = f.unlimited
			? `${formatNumber(f.usage)} used (unlimited)`
			: `${formatUsageRatio(f.usage, f.includedUsage)}  ${formatUsageBar(f.usage, f.includedUsage)}`;
		const balanceStr =
			f.balance !== null && !f.unlimited ? `\nRemaining: ${formatNumber(f.balance)}` : "";
		children.push(
			Text(
				`${getUsageEmoji(f.usage, f.includedUsage)} *${f.featureName || f.featureId}*\n${usageStr}${balanceStr}`,
			),
		);
	}

	if (features.length === 0) {
		children.push(Text("No feature usage found."));
	}

	return Card({ title: `Usage: ${customerName || customerId}`, children });
}
