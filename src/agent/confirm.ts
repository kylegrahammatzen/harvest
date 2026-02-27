import type { ActionEvent } from "chat";
import { Actions, Card, Divider, Field, Fields, LinkButton, CardText as Text } from "chat";
import type { Autumn } from "autumn-js";
import { parseApiError, str, num } from "@/agent/shared";
import { runAgentWithContext } from "@/agent/handler";
import { getWorkspaceIdFromRaw } from "@/lib/slack";
import { createAutumnClient } from "@/services/autumn";
import { getWorkspace } from "@/services/workspace";
import { formatNumber } from "@/utils/formatters";

const AUTUMN_APP_URL = "https://app.useautumn.com";

type ActionData = Record<string, unknown>;

type CardConfig = {
	title: string;
	fields?: [string, string][];
	text?: string;
	links?: Parameters<typeof LinkButton>[0][];
};

type ActionHandler = {
	required: string[];
	describe: (d: ActionData) => string;
	execute: (autumn: Autumn, d: ActionData) => Promise<unknown>;
	card: (d: ActionData, result: unknown) => CardConfig | null;
	fallback?: string;
};

function customerUrl(id: string): string {
	return `${AUTUMN_APP_URL}/customers/${encodeURIComponent(id)}`;
}

function successCard(config: CardConfig & { confirmedBy: string }) {
	const children = [];
	if (config.fields?.length) {
		children.push(Fields(config.fields.map(([label, value]) => Field({ label, value }))));
	}
	if (config.text) {
		children.push(Text(config.text));
	}
	if (config.links?.length) {
		children.push(Actions(config.links.map((l) => LinkButton(l))));
	}
	children.push(Divider(), Text(`_${config.confirmedBy}_`));
	return Card({ title: config.title, children });
}

const actions: Record<string, ActionHandler> = {
	create_customer: {
		required: ["email"],
		describe: (d) => `create customer *${d.email || d.name}*`,
		execute: (autumn, d) =>
			autumn.customers.getOrCreate({
				customerId: null,
				name: d.name ? str(d.name) : undefined,
				email: str(d.email),
			}),
		card: (d, result) => {
			const customerId = (result as { id?: string }).id || str(d.email);
			return {
				title: "Customer Created",
				fields: [
					["Name", str(d.name || d.email)],
					["Email", `\`${str(d.email)}\``],
					["ID", `\`${customerId}\``],
				],
				links: [{ label: "View in Autumn", url: customerUrl(customerId) }],
			};
		},
	},
	create_balance: {
		required: ["customer_id", "feature_id"],
		describe: (d) => `create balance for *${d.customer_id}*`,
		execute: (autumn, d) =>
			autumn.balances.create({
				customerId: str(d.customer_id),
				featureId: str(d.feature_id),
				included: num(d.amount),
			}),
		card: (d) => ({
			title: "Balance Created",
			fields: [
				["Customer", str(d.customer_id)],
				["Feature", str(d.feature_id)],
				["Amount", `+${formatNumber(num(d.amount))}`],
			],
			links: [{ label: "View Customer", url: customerUrl(str(d.customer_id)) }],
		}),
	},
	set_balance: {
		required: ["customer_id", "feature_id"],
		describe: (d) => `set balance for *${d.customer_id}*`,
		execute: (autumn, d) =>
			autumn.balances.update({
				customerId: str(d.customer_id),
				featureId: str(d.feature_id),
				remaining: num(d.balance),
			}),
		card: (d) => ({
			title: "Balance Updated",
			fields: [
				["Customer", str(d.customer_id)],
				["Feature", str(d.feature_id)],
				["New Balance", formatNumber(num(d.balance))],
			],
			links: [{ label: "View Customer", url: customerUrl(str(d.customer_id)) }],
		}),
	},
	track_usage: {
		required: ["customer_id", "feature_id"],
		describe: (d) => `track usage for *${d.customer_id}*`,
		execute: (autumn, d) =>
			autumn.track({
				customerId: str(d.customer_id),
				featureId: str(d.feature_id),
				value: num(d.value, 1),
			}),
		card: (d) => {
			const value = num(d.value, 1);
			return {
				title: "Usage Tracked",
				fields: [
					["Customer", str(d.customer_id)],
					["Feature", str(d.feature_id)],
					["Value", `${value >= 0 ? "+" : ""}${formatNumber(value)}`],
				],
				links: [{ label: "View Customer", url: customerUrl(str(d.customer_id)) }],
			};
		},
	},
	attach_plan: {
		required: ["customer_id", "plan_id"],
		describe: (d) => `attach *${d.plan_id}* to *${d.customer_id}*`,
		execute: (autumn, d) => {
			const params: Record<string, unknown> = {
				customerId: str(d.customer_id),
				planId: str(d.plan_id),
			};
			if (d.customize) params.customize = d.customize;
			if (d.success_url) params.successUrl = d.success_url;
			return autumn.billing.attach(params as Parameters<typeof autumn.billing.attach>[0]);
		},
		card: (d) => ({
			title: "Plan Attached",
			fields: [
				["Customer", str(d.customer_id)],
				["Plan", str(d.plan_id)],
			],
			links: [{ label: "View Customer", url: customerUrl(str(d.customer_id)) }],
		}),
	},
	cancel_subscription: {
		required: ["customer_id", "plan_id"],
		describe: (d) => `cancel *${d.plan_id}* for *${d.customer_id}*`,
		execute: (autumn, d) =>
			autumn.billing.update({
				customerId: str(d.customer_id),
				planId: str(d.plan_id),
				cancelAction: "cancel_end_of_cycle",
			}),
		card: (d) => ({
			title: "Subscription Canceled",
			fields: [
				["Customer", str(d.customer_id)],
				["Plan", str(d.plan_id)],
			],
			text: "Cancellation takes effect at the end of the current billing cycle.",
			links: [{ label: "View Customer", url: customerUrl(str(d.customer_id)) }],
		}),
	},
	update_subscription: {
		required: ["customer_id", "plan_id"],
		describe: (d) => `update *${d.plan_id}* for *${d.customer_id}*`,
		execute: (autumn, d) => {
			const params: Record<string, unknown> = {
				customerId: str(d.customer_id),
				planId: str(d.plan_id),
			};
			if (d.cancel_action) params.cancelAction = d.cancel_action;
			if (d.feature_quantities) params.featureQuantities = d.feature_quantities;
			return autumn.billing.update(params as Parameters<typeof autumn.billing.update>[0]);
		},
		card: (d) => ({
			title: "Subscription Updated",
			fields: [
				["Customer", str(d.customer_id)],
				["Plan", str(d.plan_id)],
			],
			links: [{ label: "View Customer", url: customerUrl(str(d.customer_id)) }],
		}),
	},
	generate_checkout_url: {
		required: ["customer_id", "plan_id"],
		describe: (d) => `generate checkout for *${d.customer_id}*`,
		execute: (autumn, d) => {
			const params: Record<string, unknown> = {
				customerId: str(d.customer_id),
				planId: str(d.plan_id),
			};
			if (d.customize) params.customize = d.customize;
			if (d.success_url) params.successUrl = d.success_url;
			return autumn.billing.attach(params as Parameters<typeof autumn.billing.attach>[0]);
		},
		card: (d, result) => {
			const paymentUrl = (result as { paymentUrl?: string | null }).paymentUrl;
			if (paymentUrl) {
				return {
					title: "Checkout URL",
					fields: [
						["Customer", str(d.customer_id)],
						["Plan", str(d.plan_id)],
					],
					links: [
						{ label: "Open Checkout", url: paymentUrl, style: "primary" as const },
						{ label: "View Customer", url: customerUrl(str(d.customer_id)) },
					],
				};
			}
			return {
				title: "Plan Attached",
				text: `Attached *${str(d.plan_id)}* to *${str(d.customer_id)}* (no payment required).`,
				links: [{ label: "View Customer", url: customerUrl(str(d.customer_id)) }],
			};
		},
	},
	setup_payment: {
		required: ["customer_id"],
		describe: (d) => `set up payment for *${d.customer_id}*`,
		execute: (autumn, d) =>
			autumn.billing.setupPayment({ customerId: str(d.customer_id) }),
		card: (d, result) => {
			const paymentUrl = (result as { url?: string }).url;
			if (!paymentUrl) return null;
			return {
				title: "Payment Setup",
				fields: [["Customer", str(d.customer_id)]],
				links: [
					{ label: "Setup Payment", url: paymentUrl, style: "primary" as const },
					{ label: "View Customer", url: customerUrl(str(d.customer_id)) },
				],
			};
		},
		fallback: "Payment setup completed but no URL was returned.",
	},
	update_customer: {
		required: ["customer_id"],
		describe: (d) => `update customer *${d.customer_id}*`,
		execute: (autumn, d) => {
			const params: Record<string, unknown> = { customerId: str(d.customer_id) };
			if (d.name) params.name = d.name;
			if (d.email) params.email = d.email;
			return autumn.customers.update(
				params as Parameters<typeof autumn.customers.update>[0],
			);
		},
		card: (d) => {
			const fields: [string, string][] = [["Customer", str(d.customer_id)]];
			if (d.name) fields.push(["Name", str(d.name)]);
			if (d.email) fields.push(["Email", `\`${str(d.email)}\``]);
			return {
				title: "Customer Updated",
				fields,
				links: [{ label: "View in Autumn", url: customerUrl(str(d.customer_id)) }],
			};
		},
	},
	create_referral_code: {
		required: ["customer_id", "program_id"],
		describe: (d) => `create referral code for *${d.customer_id}*`,
		execute: (autumn, d) =>
			autumn.referrals.createCode({
				customerId: str(d.customer_id),
				programId: str(d.program_id),
			}),
		card: (d, result) => ({
			title: "Referral Code Created",
			fields: [
				["Code", (result as { code?: string }).code || "unknown"],
				["Customer", str(d.customer_id)],
				["Program", str(d.program_id)],
			],
			links: [{ label: "View Customer", url: customerUrl(str(d.customer_id)) }],
		}),
	},
	redeem_referral_code: {
		required: ["code", "customer_id"],
		describe: (d) => `redeem referral code for *${d.customer_id}*`,
		execute: (autumn, d) =>
			autumn.referrals.redeemCode({
				code: str(d.code),
				customerId: str(d.customer_id),
			}),
		card: (d) => ({
			title: "Referral Code Redeemed",
			fields: [
				["Code", str(d.code)],
				["Customer", str(d.customer_id)],
			],
			links: [{ label: "View Customer", url: customerUrl(str(d.customer_id)) }],
		}),
	},
};

export async function handleConfirmAction(event: ActionEvent): Promise<void> {
	if (!event.value) {
		await event.thread.post("No action data found.");
		return;
	}

	let actionData: ActionData & { action: string };
	try {
		actionData = JSON.parse(event.value);
	} catch {
		await event.thread.post("Invalid action data.");
		return;
	}

	const workspaceId = getWorkspaceIdFromRaw(event.raw);
	if (!workspaceId) {
		await event.thread.post("Could not resolve workspace for this action.");
		return;
	}

	const workspace = await getWorkspace(workspaceId);
	if (!workspace) {
		await event.thread.post("Workspace not connected.");
		return;
	}

	const autumn = createAutumnClient(workspace);
	const confirmedBy = event.user.fullName || event.user.userId;
	const handler = actions[actionData.action];

	if (!handler) {
		await event.thread.post(`Unknown action: ${actionData.action}`);
		return;
	}

	const missing = handler.required.find((k) => {
		const v = actionData[k];
		return v == null || v === "";
	});
	if (missing) {
		await event.thread.post(`Invalid ${actionData.action} payload.`);
		return;
	}

	try {
		const result = await handler.execute(autumn, actionData);
		const cardConfig = handler.card(actionData, result);
		if (cardConfig) {
			await event.thread.post(successCard({ ...cardConfig, confirmedBy }));
		} else if (handler.fallback) {
			await event.thread.post(handler.fallback);
		}
	} catch (err) {
		const reason = parseApiError(err);
		const desc = handler.describe(actionData);
		console.error("Confirm action failed", {
			action: desc,
			error: reason,
			org: workspace.orgName,
			thread: event.threadId,
		});
		await event.adapter.editMessage(event.threadId, event.messageId, {
			markdown: `Could not ${desc}: ${reason}`,
		});
		const depth = Number(actionData._recoveryDepth) || 0;
		await runAgentWithContext(
			event.thread,
			event.raw,
			`The confirmed action failed: could not ${desc}. Error: ${reason}. Look up the correct IDs and try again.`,
			depth + 1,
		);
	}
}

export async function handleCancelAction(event: ActionEvent): Promise<void> {
	const name = event.user.fullName || event.user.userId;
	await event.thread.post(`_Canceled by ${name}_`);
}
