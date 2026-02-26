import type { CardChild } from "chat";
import { Actions, Card, LinkButton, CardText as Text } from "chat";
import {
	formatDate,
	formatNumber,
	formatRelativeTime,
	formatUsageBar,
	formatUsageRatio,
} from "@/utils/formatters";

type AlertCardProps = {
	dashboardUrl?: string;
};

type PlanChangedProps = AlertCardProps & {
	customerId: string;
	customerName?: string;
	fromPlan: string;
	toPlan: string;
	direction: "upgrade" | "downgrade" | "change";
};

export function PlanChangedCard({
	customerId,
	customerName,
	fromPlan,
	toPlan,
	direction,
	dashboardUrl,
}: PlanChangedProps) {
	const emoji = direction === "upgrade" ? "⬆️" : direction === "downgrade" ? "⬇️" : "🔄";
	const label = direction.charAt(0).toUpperCase() + direction.slice(1);

	const children: CardChild[] = [
		Text(`*${customerName || customerId}* ${direction}d from ${fromPlan} to ${toPlan}.`),
	];

	if (dashboardUrl) {
		children.push(Actions([LinkButton({ label: "View Details", url: dashboardUrl })]));
	}

	return Card({ title: `${emoji} Plan ${label}`, children });
}

type CanceledProps = AlertCardProps & {
	customerId: string;
	customerName?: string;
	planName: string;
	cancelsAt?: number;
};

export function SubscriptionCanceledCard({
	customerId,
	customerName,
	planName,
	cancelsAt,
	dashboardUrl,
}: CanceledProps) {
	const children: CardChild[] = [
		Text(
			`*${customerName || customerId}* canceled ${planName}.${cancelsAt ? ` Access ends ${formatDate(cancelsAt)}.` : ""}`,
		),
	];

	if (dashboardUrl) {
		children.push(Actions([LinkButton({ label: "View Details", url: dashboardUrl })]));
	}

	return Card({ title: "❌ Subscription Canceled", children });
}

type TrialEndingProps = AlertCardProps & {
	customerId: string;
	customerName?: string;
	planName: string;
	trialEndsAt: number;
	usage?: { featureId: string; used: number; total: number };
};

export function TrialEndingCard({
	customerId,
	customerName,
	planName,
	trialEndsAt,
	usage,
	dashboardUrl,
}: TrialEndingProps) {
	const children: CardChild[] = [
		Text(
			`*${customerName || customerId}* trial for ${planName} ends ${formatRelativeTime(trialEndsAt)}.`,
		),
	];

	if (usage) {
		children.push(Text(`Usage: ${formatUsageRatio(usage.used, usage.total)}`));
	}

	if (dashboardUrl) {
		children.push(Actions([LinkButton({ label: "View Details", url: dashboardUrl })]));
	}

	return Card({ title: "⏳ Trial Ending", children });
}

type TrialConvertedProps = AlertCardProps & {
	customerId: string;
	customerName?: string;
	planName: string;
};

export function TrialConvertedCard({
	customerId,
	customerName,
	planName,
	dashboardUrl,
}: TrialConvertedProps) {
	const children: CardChild[] = [Text(`*${customerName || customerId}* converted to ${planName}.`)];

	if (dashboardUrl) {
		children.push(Actions([LinkButton({ label: "View Details", url: dashboardUrl })]));
	}

	return Card({ title: "🎉 Trial Converted", children });
}

type UsageAlertProps = AlertCardProps & {
	customerId: string;
	customerName?: string;
	featureId: string;
	used: number;
	total: number;
	threshold: number;
	nextResetAt?: number;
};

export function UsageAlertCard({
	customerId,
	customerName,
	featureId,
	used,
	total,
	threshold: _threshold,
	nextResetAt,
	dashboardUrl,
}: UsageAlertProps) {
	const pct = Math.round((used / total) * 100);
	const isLimitReached = used >= total;
	const emoji = isLimitReached ? "🚨" : "📊";
	const title = isLimitReached ? "Limit Reached" : `Usage Alert (${pct}%)`;

	const children: CardChild[] = [
		Text(
			`*${customerName || customerId}* has ${isLimitReached ? "hit the" : `reached ${pct}% of`} *${featureId}* limit.`,
		),
		Text(`Usage: ${formatUsageRatio(used, total)} ${formatUsageBar(used, total)}`),
	];

	if (!isLimitReached) {
		children.push(
			Text(
				`Remaining: ${formatNumber(total - used)}${nextResetAt ? ` (Resets ${formatDate(nextResetAt)})` : ""}`,
			),
		);
	}

	if (dashboardUrl) {
		children.push(Actions([LinkButton({ label: "View Customer", url: dashboardUrl })]));
	}

	return Card({ title: `${emoji} ${title}`, children });
}

type BalanceAddedProps = AlertCardProps & {
	customerId: string;
	customerName?: string;
	featureId: string;
	amount: number;
	newBalance?: number;
};

export function BalanceAddedCard({
	customerId,
	customerName,
	featureId,
	amount,
	newBalance,
	dashboardUrl,
}: BalanceAddedProps) {
	const children: CardChild[] = [
		Text(`*${customerName || customerId}* received +${formatNumber(amount)} *${featureId}*.`),
	];

	if (newBalance !== undefined) {
		children.push(Text(`New balance: ${formatNumber(newBalance)} remaining`));
	}

	if (dashboardUrl) {
		children.push(Actions([LinkButton({ label: "View Details", url: dashboardUrl })]));
	}

	return Card({ title: "🎁 Balance Added", children });
}
