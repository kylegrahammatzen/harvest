import { Actions, Card, Field, Fields, LinkButton, CardText as Text } from "chat";
import { defineCommand, postPrivate, postPublic } from "@/lib/command";

export const checkoutCommand = defineCommand(async ({ event, autumn, args }) => {
	const [customerId, planId] = args;

	if (!customerId || !planId) {
		await postPrivate(
			event,
			"Usage: `/checkout <customer_id> <plan_id>`\nExample: `/checkout acme pro`",
		);
		return;
	}

	try {
		const result = await autumn.billing.attach({
			customerId,
			planId,
		});

		const checkoutUrl = result.paymentUrl;

		if (checkoutUrl) {
			await postPublic(
				event,
				Card({
					title: "Checkout Link Generated",
					children: [
						Fields([
							Field({ label: "Customer", value: customerId }),
							Field({ label: "Plan", value: planId }),
						]),
						Text("Share this link with the customer to complete checkout:"),
						Actions([LinkButton({ label: "Open Checkout", url: checkoutUrl })]),
					],
				}),
			);
		} else {
			await postPublic(
				event,
				Card({
					title: "Plan Attached",
					children: [
						Fields([
							Field({ label: "Customer", value: customerId }),
							Field({ label: "Plan", value: planId }),
						]),
						Text("Plan attached successfully — no checkout required."),
					],
				}),
			);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await postPrivate(event, `Failed to attach plan: ${message}`);
	}
});
