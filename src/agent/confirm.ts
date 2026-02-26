import type { ActionEvent } from "chat";
import { Actions, Card, Divider, Field, Fields, LinkButton, CardText as Text } from "chat";
import { AutumnError } from "autumn-js";
import { runAgentWithContext } from "@/agent/handler";
import { getWorkspaceIdFromRaw } from "@/lib/slack";
import { createAutumnClient } from "@/services/autumn";
import { getWorkspace } from "@/services/workspace";
import { formatNumber } from "@/utils/formatters";

const AUTUMN_APP_URL = "https://app.useautumn.com";

function parseApiError(err: unknown): string {
	if (err instanceof AutumnError) {
		try {
			const body = JSON.parse(err.body);
			if (body.message) return body.message;
		} catch {}
	}
	if (err instanceof Error) return err.message;
	return "Something went wrong executing the action.";
}

function describeAction(action: string, data: Record<string, unknown>): string {
	const c = data.customer_id;
	const p = data.plan_id;
	switch (action) {
		case "attach_plan":
			return `attach *${p}* to *${c}*`;
		case "cancel_subscription":
			return `cancel *${p}* for *${c}*`;
		case "create_customer":
			return `create customer *${data.email || data.name}*`;
		case "create_balance":
			return `create balance for *${c}*`;
		case "set_balance":
			return `set balance for *${c}*`;
		case "track_usage":
			return `track usage for *${c}*`;
		case "update_subscription":
			return `update *${p}* for *${c}*`;
		case "generate_checkout_url":
			return `generate checkout for *${c}*`;
		case "setup_payment":
			return `set up payment for *${c}*`;
		case "update_customer":
			return `update customer *${c}*`;
		case "create_referral_code":
			return `create referral code for *${c}*`;
		case "redeem_referral_code":
			return `redeem referral code for *${c}*`;
		default:
			return `perform ${action.replace(/_/g, " ")}`;
	}
}

function customerUrl(customerId: string): string {
	return `${AUTUMN_APP_URL}/customers/${encodeURIComponent(customerId)}`;
}

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
	const confirmedBy = event.user.fullName || event.user.userId;

	try {
		switch (actionData.action) {
			case "create_customer": {
				const email = String(actionData.email || "");
				if (!email) {
					await event.thread.post("Invalid create_customer payload.");
					break;
				}

				const customer = await autumn.customers.getOrCreate({
					customerId: null,
					name: actionData.name ? String(actionData.name) : undefined,
					email,
				});
				const customerId = customer.id || email;

				await event.thread.post(
					Card({
						title: "Customer Created",
						children: [
							Fields([
								Field({ label: "Name", value: String(actionData.name || email) }),
								Field({ label: "Email", value: `\`${email}\`` }),
								Field({ label: "ID", value: `\`${customerId}\`` }),
							]),
							Actions([
								LinkButton({
									label: "View in Autumn",
									url: customerUrl(customerId),
								}),
							]),
							Divider(),
							Text(`_${confirmedBy}_`),
						],
					}),
				);
				break;
			}

			case "create_balance": {
				const customerId = String(actionData.customer_id || "");
				const featureId = String(actionData.feature_id || "");
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
							Fields([
								Field({ label: "Customer", value: customerId }),
								Field({ label: "Feature", value: featureId }),
								Field({ label: "Amount", value: `+${formatNumber(amount)}` }),
							]),
							Actions([
								LinkButton({
									label: "View Customer",
									url: customerUrl(customerId),
								}),
							]),
							Divider(),
							Text(`_${confirmedBy}_`),
						],
					}),
				);
				break;
			}

			case "attach_plan": {
				const customerId = String(actionData.customer_id || "");
				const planId = String(actionData.plan_id || "");
				if (!customerId || !planId) {
					await event.thread.post("Invalid attach_plan payload.");
					break;
				}

				const attachParams: Record<string, unknown> = { customerId, planId };
				if (actionData.customize) attachParams.customize = actionData.customize;
				if (actionData.success_url) attachParams.successUrl = actionData.success_url;

				await autumn.billing.attach(attachParams as Parameters<typeof autumn.billing.attach>[0]);

				await event.thread.post(
					Card({
						title: "Plan Attached",
						children: [
							Fields([
								Field({ label: "Customer", value: customerId }),
								Field({ label: "Plan", value: planId }),
							]),
							Actions([
								LinkButton({
									label: "View Customer",
									url: customerUrl(customerId),
								}),
							]),
							Divider(),
							Text(`_${confirmedBy}_`),
						],
					}),
				);
				break;
			}

			case "cancel_subscription": {
				const customerId = String(actionData.customer_id || "");
				const planId = String(actionData.plan_id || "");
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
							Fields([
								Field({ label: "Customer", value: customerId }),
								Field({ label: "Plan", value: planId }),
							]),
							Text("Cancellation takes effect at the end of the current billing cycle."),
							Actions([
								LinkButton({
									label: "View Customer",
									url: customerUrl(customerId),
								}),
							]),
							Divider(),
							Text(`_${confirmedBy}_`),
						],
					}),
				);
				break;
			}

			case "set_balance": {
				const customerId = String(actionData.customer_id || "");
				const featureId = String(actionData.feature_id || "");
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
							Fields([
								Field({ label: "Customer", value: customerId }),
								Field({ label: "Feature", value: featureId }),
								Field({ label: "New Balance", value: formatNumber(balance) }),
							]),
							Actions([
								LinkButton({
									label: "View Customer",
									url: customerUrl(customerId),
								}),
							]),
							Divider(),
							Text(`_${confirmedBy}_`),
						],
					}),
				);
				break;
			}

			case "track_usage": {
				const customerId = String(actionData.customer_id || "");
				const featureId = String(actionData.feature_id || "");
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
							Fields([
								Field({ label: "Customer", value: customerId }),
								Field({ label: "Feature", value: featureId }),
								Field({
									label: "Value",
									value: `${value >= 0 ? "+" : ""}${formatNumber(value)}`,
								}),
							]),
							Actions([
								LinkButton({
									label: "View Customer",
									url: customerUrl(customerId),
								}),
							]),
							Divider(),
							Text(`_${confirmedBy}_`),
						],
					}),
				);
				break;
			}

			case "update_subscription": {
				const customerId = String(actionData.customer_id || "");
				const planId = String(actionData.plan_id || "");
				if (!customerId || !planId) {
					await event.thread.post("Invalid update_subscription payload.");
					break;
				}

				const updateParams: Record<string, unknown> = { customerId, planId };
				if (actionData.cancel_action) updateParams.cancelAction = actionData.cancel_action;
				if (actionData.feature_quantities)
					updateParams.featureQuantities = actionData.feature_quantities;

				await autumn.billing.update(updateParams as Parameters<typeof autumn.billing.update>[0]);

				await event.thread.post(
					Card({
						title: "Subscription Updated",
						children: [
							Fields([
								Field({ label: "Customer", value: customerId }),
								Field({ label: "Plan", value: planId }),
							]),
							Actions([
								LinkButton({
									label: "View Customer",
									url: customerUrl(customerId),
								}),
							]),
							Divider(),
							Text(`_${confirmedBy}_`),
						],
					}),
				);
				break;
			}

			case "generate_checkout_url": {
				const customerId = String(actionData.customer_id || "");
				const planId = String(actionData.plan_id || "");
				if (!customerId || !planId) {
					await event.thread.post("Invalid generate_checkout_url payload.");
					break;
				}

				const checkoutParams: Record<string, unknown> = { customerId, planId };
				if (actionData.customize) checkoutParams.customize = actionData.customize;
				if (actionData.success_url) checkoutParams.successUrl = actionData.success_url;

				const result = await autumn.billing.attach(
					checkoutParams as Parameters<typeof autumn.billing.attach>[0],
				);
				const paymentUrl = (result as { paymentUrl?: string | null }).paymentUrl;

				if (paymentUrl) {
					await event.thread.post(
						Card({
							title: "Checkout URL",
							children: [
								Fields([
									Field({ label: "Customer", value: customerId }),
									Field({ label: "Plan", value: planId }),
								]),
								Actions([
									LinkButton({
										label: "Open Checkout",
										url: paymentUrl,
										style: "primary",
									}),
									LinkButton({
										label: "View Customer",
										url: customerUrl(customerId),
									}),
								]),
								Divider(),
								Text(`_${confirmedBy}_`),
							],
						}),
					);
				} else {
					await event.thread.post(
						Card({
							title: "Plan Attached",
							children: [
								Text(`Attached *${planId}* to *${customerId}* (no payment required).`),
								Actions([
									LinkButton({
										label: "View Customer",
										url: customerUrl(customerId),
									}),
								]),
								Divider(),
								Text(`_${confirmedBy}_`),
							],
						}),
					);
				}
				break;
			}

			case "setup_payment": {
				const customerId = String(actionData.customer_id || "");
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
								Fields([Field({ label: "Customer", value: customerId })]),
								Actions([
									LinkButton({
										label: "Setup Payment",
										url: paymentUrl,
										style: "primary",
									}),
									LinkButton({
										label: "View Customer",
										url: customerUrl(customerId),
									}),
								]),
								Divider(),
								Text(`_${confirmedBy}_`),
							],
						}),
					);
				} else {
					await event.thread.post("Payment setup completed but no URL was returned.");
				}
				break;
			}

			case "update_customer": {
				const customerId = String(actionData.customer_id || "");
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

				const fields = [Field({ label: "Customer", value: customerId })];
				if (actionData.name) fields.push(Field({ label: "Name", value: String(actionData.name) }));
				if (actionData.email)
					fields.push(Field({ label: "Email", value: `\`${actionData.email}\`` }));

				await event.thread.post(
					Card({
						title: "Customer Updated",
						children: [
							Fields(fields),
							Actions([
								LinkButton({
									label: "View in Autumn",
									url: customerUrl(customerId),
								}),
							]),
							Divider(),
							Text(`_${confirmedBy}_`),
						],
					}),
				);
				break;
			}

			case "create_referral_code": {
				const customerId = String(actionData.customer_id || "");
				const programId = String(actionData.program_id || "");
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
							Fields([
								Field({ label: "Code", value: code }),
								Field({ label: "Customer", value: customerId }),
								Field({ label: "Program", value: programId }),
							]),
							Actions([
								LinkButton({
									label: "View Customer",
									url: customerUrl(customerId),
								}),
							]),
							Divider(),
							Text(`_${confirmedBy}_`),
						],
					}),
				);
				break;
			}

			case "redeem_referral_code": {
				const code = String(actionData.code || "");
				const customerId = String(actionData.customer_id || "");
				if (!code || !customerId) {
					await event.thread.post("Invalid redeem_referral_code payload.");
					break;
				}

				await autumn.referrals.redeemCode({ code, customerId });

				await event.thread.post(
					Card({
						title: "Referral Code Redeemed",
						children: [
							Fields([
								Field({ label: "Code", value: code }),
								Field({ label: "Customer", value: customerId }),
							]),
							Actions([
								LinkButton({
									label: "View Customer",
									url: customerUrl(customerId),
								}),
							]),
							Divider(),
							Text(`_${confirmedBy}_`),
						],
					}),
				);
				break;
			}

			default:
				await event.thread.post(`Unknown action: ${actionData.action}`);
		}
	} catch (err) {
		const reason = parseApiError(err);
		const statusCode = err instanceof AutumnError ? err.statusCode : undefined;
		const desc = describeAction(actionData.action, actionData);
		console.error("Confirm action failed", {
			action: desc,
			error: reason,
			statusCode,
			org: workspace.orgName,
			thread: event.threadId,
		});
		await event.adapter.editMessage(event.threadId, event.messageId, {
			markdown: `Could not ${desc}: ${reason}`,
		});
		await runAgentWithContext(
			event.thread,
			event.raw,
			`The confirmed action failed: could not ${desc}. Error: ${reason}. Look up the correct IDs and try again.`,
		);
	}
}

export async function handleCancelAction(event: ActionEvent): Promise<void> {
	const name = event.user.fullName || event.user.userId;
	await event.thread.post(`_Canceled by ${name}_`);
}
