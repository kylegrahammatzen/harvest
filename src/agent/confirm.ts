import type { ActionEvent } from "chat";
import { Actions, Card, LinkButton, CardText as Text } from "chat";
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
	const confirmedBy = `_Confirmed by ${event.user.fullName || event.user.userId}_`;

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
							Text(confirmedBy),
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

				const attachParams: Record<string, unknown> = { customerId, planId };
				if (actionData.customize) attachParams.customize = actionData.customize;
				if (actionData.successUrl) attachParams.successUrl = actionData.successUrl;

				await autumn.billing.attach(attachParams as Parameters<typeof autumn.billing.attach>[0]);

				await event.thread.post(
					Card({
						title: "Plan Attached",
						children: [Text(`Attached *${planId}* to *${customerId}*.`), Text(confirmedBy)],
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
						children: [Text(`Canceled *${planId}* for *${customerId}*.`), Text(confirmedBy)],
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
							Text(confirmedBy),
						],
					}),
				);
				break;
			}

			case "track_usage": {
				const customerId = String(actionData.customerId || "");
				const featureId = String(actionData.featureId || "");
				const value = Number(actionData.value ?? 1);
				if (!customerId || !featureId || Number.isNaN(value)) {
					await event.thread.post("Invalid track_usage payload.");
					break;
				}

				await autumn.track({ customerId, featureId, value });

				await event.thread.post(
					Card({
						title: "Usage Tracked",
						children: [
							Text(
								`Tracked ${value >= 0 ? "+" : ""}${formatNumber(value)} *${featureId}* for *${customerId}*.`,
							),
							Text(confirmedBy),
						],
					}),
				);
				break;
			}

			case "update_subscription": {
				const customerId = String(actionData.customerId || "");
				const planId = String(actionData.planId || "");
				if (!customerId || !planId) {
					await event.thread.post("Invalid update_subscription payload.");
					break;
				}

				const updateParams: Record<string, unknown> = { customerId, planId };
				if (actionData.cancelAction) updateParams.cancelAction = actionData.cancelAction;
				if (actionData.featureQuantities)
					updateParams.featureQuantities = actionData.featureQuantities;

				await autumn.billing.update(updateParams as Parameters<typeof autumn.billing.update>[0]);

				await event.thread.post(
					Card({
						title: "Subscription Updated",
						children: [Text(`Updated *${planId}* for *${customerId}*.`), Text(confirmedBy)],
					}),
				);
				break;
			}

			case "generate_checkout_url": {
				const customerId = String(actionData.customerId || "");
				const planId = String(actionData.planId || "");
				if (!customerId || !planId) {
					await event.thread.post("Invalid generate_checkout_url payload.");
					break;
				}

				const checkoutParams: Record<string, unknown> = { customerId, planId };
				if (actionData.customize) checkoutParams.customize = actionData.customize;
				if (actionData.successUrl) checkoutParams.successUrl = actionData.successUrl;

				const result = await autumn.billing.attach(
					checkoutParams as Parameters<typeof autumn.billing.attach>[0],
				);
				const paymentUrl = (result as { paymentUrl?: string | null }).paymentUrl;

				if (paymentUrl) {
					await event.thread.post(
						Card({
							title: "Checkout URL",
							children: [
								Text(`Checkout link for *${customerId}* on *${planId}*:`),
								Actions([
									LinkButton({
										label: "Open Checkout",
										url: paymentUrl,
										style: "primary",
									}),
								]),
								Text(confirmedBy),
							],
						}),
					);
				} else {
					await event.thread.post(
						Card({
							title: "Plan Attached",
							children: [
								Text(`Attached *${planId}* to *${customerId}* (no payment required).`),
								Text(confirmedBy),
							],
						}),
					);
				}
				break;
			}

			case "setup_payment": {
				const customerId = String(actionData.customerId || "");
				if (!customerId) {
					await event.thread.post("Invalid setup_payment payload.");
					break;
				}

				const result = await autumn.billing.setupPayment({ customerId });
				const paymentUrl = (result as { url?: string }).url;

				if (paymentUrl) {
					await event.thread.post(
						Card({
							title: "Payment Setup",
							children: [
								Text(`Payment setup link for *${customerId}*:`),
								Actions([
									LinkButton({
										label: "Setup Payment",
										url: paymentUrl,
										style: "primary",
									}),
								]),
								Text(confirmedBy),
							],
						}),
					);
				} else {
					await event.thread.post("Payment setup completed but no URL was returned.");
				}
				break;
			}

			case "update_customer": {
				const customerId = String(actionData.customerId || "");
				if (!customerId) {
					await event.thread.post("Invalid update_customer payload.");
					break;
				}

				const updateFields: Record<string, unknown> = { customerId };
				if (actionData.name) updateFields.name = actionData.name;
				if (actionData.email) updateFields.email = actionData.email;

				await autumn.customers.update(
					updateFields as Parameters<typeof autumn.customers.update>[0],
				);

				const changes = [
					actionData.name ? `name -> *${actionData.name}*` : null,
					actionData.email ? `email -> *${actionData.email}*` : null,
				]
					.filter(Boolean)
					.join(", ");

				await event.thread.post(
					Card({
						title: "Customer Updated",
						children: [Text(`Updated *${customerId}*: ${changes}.`), Text(confirmedBy)],
					}),
				);
				break;
			}

			case "create_referral_code": {
				const customerId = String(actionData.customerId || "");
				const programId = String(actionData.programId || "");
				if (!customerId || !programId) {
					await event.thread.post("Invalid create_referral_code payload.");
					break;
				}

				const result = await autumn.referrals.createCode({ customerId, programId });
				const code = (result as { code?: string }).code || "unknown";

				await event.thread.post(
					Card({
						title: "Referral Code Created",
						children: [
							Text(
								`Referral code \`${code}\` created for *${customerId}* in program *${programId}*.`,
							),
							Text(confirmedBy),
						],
					}),
				);
				break;
			}

			case "redeem_referral_code": {
				const code = String(actionData.code || "");
				const customerId = String(actionData.customerId || "");
				if (!code || !customerId) {
					await event.thread.post("Invalid redeem_referral_code payload.");
					break;
				}

				await autumn.referrals.redeemCode({ code, customerId });

				await event.thread.post(
					Card({
						title: "Referral Code Redeemed",
						children: [
							Text(`Referral code \`${code}\` redeemed for *${customerId}*.`),
							Text(confirmedBy),
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
