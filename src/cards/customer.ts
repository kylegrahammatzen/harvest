import type { CardChild, FieldElement } from "chat";
import { Actions, Card, Divider, Field, Fields, LinkButton, CardText as Text } from "chat";
import {
	formatDate,
	formatRelativeTime,
	formatUsageBar,
	formatUsageRatio,
} from "@/utils/formatters";

type CustomerBalance = {
	featureId: string;
	balance: number | null;
	usage: number;
	includedUsage: number;
	unlimited?: boolean;
	nextResetAt?: number | null;
};

type CustomerSubscription = {
	planId: string;
	planName?: string;
	status: string;
	currentPeriodEnd?: number;
	canceledAt?: number | null;
	trialEnd?: number | null;
};

type CustomerCardProps = {
	customerId: string;
	customerName?: string | null;
	customerEmail?: string | null;
	subscriptions: CustomerSubscription[];
	balances: CustomerBalance[];
	dashboardUrl?: string;
};

export function CustomerCard({
	customerId,
	customerName,
	customerEmail,
	subscriptions,
	balances,
	dashboardUrl,
}: CustomerCardProps) {
	const activeSubs = subscriptions.filter((s) => s.status === "active" || s.status === "trialing");
	const planDisplay =
		activeSubs.length > 0
			? activeSubs.map((s) => s.planName || s.planId).join(", ")
			: "No active plan";

	const fields: FieldElement[] = [Field({ label: "Customer ID", value: customerId })];

	if (customerEmail) {
		fields.push(Field({ label: "Email", value: customerEmail }));
	}

	fields.push(Field({ label: "Plan", value: planDisplay }));

	if (activeSubs[0]?.currentPeriodEnd) {
		fields.push(
			Field({
				label: "Renewal",
				value: `${formatDate(activeSubs[0].currentPeriodEnd)} (${formatRelativeTime(activeSubs[0].currentPeriodEnd)})`,
			}),
		);
	}

	if (activeSubs[0]?.status === "trialing" && activeSubs[0]?.trialEnd) {
		fields.push(
			Field({
				label: "Trial Ends",
				value: `${formatDate(activeSubs[0].trialEnd)} (${formatRelativeTime(activeSubs[0].trialEnd)})`,
			}),
		);
	}

	const children: CardChild[] = [Fields(fields)];

	if (balances.length > 0) {
		children.push(Divider());
		children.push(Text("*Balances*"));
		for (const b of balances) {
			const usageStr = b.unlimited
				? "unlimited"
				: `${formatUsageRatio(b.usage, b.includedUsage)}  ${formatUsageBar(b.usage, b.includedUsage)}`;
			const resetStr = b.nextResetAt ? `  _(resets ${formatDate(b.nextResetAt)})_` : "";
			children.push(Text(`\`${b.featureId}\` ${usageStr}${resetStr}`));
		}
	}

	if (dashboardUrl) {
		children.push(Divider());
		children.push(Actions([LinkButton({ label: "View in Dashboard", url: dashboardUrl })]));
	}

	return Card({ title: `${customerName || customerId}`, children });
}
