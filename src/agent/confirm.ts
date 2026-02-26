import type { ActionEvent } from "chat";
import { Card, CardText as Text } from "chat";
import { getWorkspaceIdFromRaw } from "@/lib/slack";
import { createAutumnClient } from "@/services/autumn";
import { getWorkspace } from "@/services/workspace";
import { formatNumber } from "@/utils/formatters";

export async function handleConfirmAction(event: ActionEvent): Promise<void> {
	if (!event.value) {
		await event.thread.post("No action data found.");
		return;
	}

	let actionData: { action: string; [key: string]: unknown };
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

	try {
		switch (actionData.action) {
			case "create_balance": {
				const customerId = String(actionData.customerId || "");
				const featureId = String(actionData.featureId || "");
				const amount = Number(actionData.amount || 0);
				if (!customerId || !featureId || Number.isNaN(amount)) {
					await event.thread.post("Invalid create_balance payload.");
					break;
				}

				await autumn.balances.create({
					customerId,
					featureId,
					included: amount,
				});

				await event.thread.post(
					Card({
						title: "Balance Created",
						children: [
							Text(`Granted +${formatNumber(amount)} *${featureId}* to *${customerId}*.`),
							Text(`_Confirmed by ${event.user.fullName || event.user.userId}_`),
						],
					}),
				);
				break;
			}

			case "attach_plan": {
				const customerId = String(actionData.customerId || "");
				const planId = String(actionData.planId || "");
				if (!customerId || !planId) {
					await event.thread.post("Invalid attach_plan payload.");
					break;
				}

				await autumn.billing.attach({
					customerId,
					planId,
				});

				await event.thread.post(
					Card({
						title: "Plan Attached",
						children: [
							Text(`Attached *${planId}* to *${customerId}*.`),
							Text(`_Confirmed by ${event.user.fullName || event.user.userId}_`),
						],
					}),
				);
				break;
			}

			case "cancel_subscription": {
				const customerId = String(actionData.customerId || "");
				const planId = String(actionData.planId || "");
				if (!customerId || !planId) {
					await event.thread.post("Invalid cancel_subscription payload.");
					break;
				}

				await autumn.billing.update({
					customerId,
					planId,
					cancelAction: "cancel_end_of_cycle",
				});

				await event.thread.post(
					Card({
						title: "Subscription Canceled",
						children: [
							Text(`Canceled *${planId}* for *${customerId}*.`),
							Text(`_Confirmed by ${event.user.fullName || event.user.userId}_`),
						],
					}),
				);
				break;
			}

			case "set_balance": {
				const customerId = String(actionData.customerId || "");
				const featureId = String(actionData.featureId || "");
				const balance = Number(actionData.balance || 0);
				if (!customerId || !featureId || Number.isNaN(balance)) {
					await event.thread.post("Invalid set_balance payload.");
					break;
				}

				await autumn.balances.update({
					customerId,
					featureId,
					remaining: balance,
				});

				await event.thread.post(
					Card({
						title: "Balance Updated",
						children: [
							Text(`Set *${featureId}* balance to ${formatNumber(balance)} for *${customerId}*.`),
							Text(`_Confirmed by ${event.user.fullName || event.user.userId}_`),
						],
					}),
				);
				break;
			}

			default:
				await event.thread.post(`Unknown action: ${actionData.action}`);
		}
	} catch (err) {
		console.error("Confirm action error:", err);
		await event.thread.post("Something went wrong executing the action.");
	}
}

export async function handleCancelAction(event: ActionEvent): Promise<void> {
	await event.thread.post(`_Action canceled by ${event.user.fullName || event.user.userId}._`);
}
