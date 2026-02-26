import { bot } from "@/bot";
import {
	BalanceAddedCard,
	PlanChangedCard,
	SubscriptionCanceledCard,
	TrialConvertedCard,
	TrialEndingCard,
	UsageAlertCard,
} from "@/cards/alert";
import { getWorkspace, listWorkspaces } from "@/services/workspace";

type AutumnWebhookEvent = {
	type: string;
	data: Record<string, unknown>;
	org_id?: string;
};

export async function routeAutumnEvent(event: AutumnWebhookEvent): Promise<void> {
	const workspace = await findWorkspaceForEvent(event);
	if (!workspace) {
		console.warn(`No workspace found for Autumn event: ${event.type}`);
		return;
	}

	if (!workspace.alertChannel) {
		console.warn(`No alert channel configured for workspace: ${workspace.workspaceId}`);
		return;
	}

	const card = buildAlertCard(event);
	if (!card) {
		console.log(`No alert card for event type: ${event.type}`);
		return;
	}

	try {
		const channelId = workspace.alertChannel.startsWith("slack:")
			? workspace.alertChannel
			: `slack:${workspace.alertChannel}`;
		await bot.channel(channelId).post(card);
	} catch (err) {
		console.error(`Failed to post alert to channel ${workspace.alertChannel}:`, err);
	}
}

async function findWorkspaceForEvent(event: AutumnWebhookEvent) {
	const workspaceIds = await listWorkspaces();
	for (const id of workspaceIds) {
		const ws = await getWorkspace(id);
		if (ws && event.org_id && ws.orgSlug === event.org_id) {
			return ws;
		}
	}
	if (workspaceIds.length === 1) {
		return getWorkspace(workspaceIds[0]);
	}
	return null;
}

function buildAlertCard(event: AutumnWebhookEvent) {
	const d = event.data;

	switch (event.type) {
		case "customer.product.updated": {
			if (d.canceled) {
				return SubscriptionCanceledCard({
					customerId: String(d.customer_id),
					customerName: d.customer_name ? String(d.customer_name) : undefined,
					planName: String(d.product_name || d.product_id),
					cancelsAt: d.cancels_at ? new Date(String(d.cancels_at)).getTime() : undefined,
				});
			}

			if (d.previous_product_id && d.product_id) {
				const direction =
					d.scenario === "upgrade"
						? "upgrade"
						: d.scenario === "downgrade"
							? "downgrade"
							: "change";
				return PlanChangedCard({
					customerId: String(d.customer_id),
					customerName: d.customer_name ? String(d.customer_name) : undefined,
					fromPlan: String(d.previous_product_name || d.previous_product_id),
					toPlan: String(d.product_name || d.product_id),
					direction,
				});
			}

			if (d.was_trialing && d.status === "active") {
				return TrialConvertedCard({
					customerId: String(d.customer_id),
					customerName: d.customer_name ? String(d.customer_name) : undefined,
					planName: String(d.product_name || d.product_id),
				});
			}

			return null;
		}

		case "customer.threshold_reached": {
			return UsageAlertCard({
				customerId: String(d.customer_id),
				customerName: d.customer_name ? String(d.customer_name) : undefined,
				featureId: String(d.feature_id),
				used: Number(d.usage) || 0,
				total: Number(d.included_usage || d.limit) || 0,
				threshold: Number(d.threshold) || 80,
				nextResetAt: d.next_reset_at ? new Date(String(d.next_reset_at)).getTime() : undefined,
			});
		}

		case "customer.balance.created": {
			return BalanceAddedCard({
				customerId: String(d.customer_id),
				customerName: d.customer_name ? String(d.customer_name) : undefined,
				featureId: String(d.feature_id),
				amount: Number(d.granted_balance || d.amount) || 0,
				newBalance: d.new_balance !== undefined ? Number(d.new_balance) : undefined,
			});
		}

		case "customer.trial.ending": {
			return TrialEndingCard({
				customerId: String(d.customer_id),
				customerName: d.customer_name ? String(d.customer_name) : undefined,
				planName: String(d.product_name || d.product_id),
				trialEndsAt: new Date(String(d.trial_end)).getTime(),
			});
		}

		default:
			return null;
	}
}
