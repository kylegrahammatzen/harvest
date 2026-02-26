import { Actions, Button, Card, Field, Fields, CardText as Text } from "chat";
import { defineCommand, postPrivate, postPublic } from "@/lib/command";
import { formatNumber } from "@/utils/formatters";

export const balanceCommand = defineCommand(async ({ event, args }) => {
	const [customerId, featureId, amountStr] = args;

	if (!customerId || !featureId || !amountStr) {
		await postPrivate(
			event,
			"Usage: `/balance <customer_id> <feature_id> <amount>`\nExample: `/balance acme messages 5000`",
		);
		return;
	}

	const amount = Number.parseInt(amountStr, 10);
	if (Number.isNaN(amount) || amount <= 0) {
		await postPrivate(event, "Amount must be a positive number.");
		return;
	}

	await postPublic(
		event,
		Card({
			title: "Create Balance",
			children: [
				Fields([
					Field({ label: "Customer", value: customerId }),
					Field({ label: "Feature", value: featureId }),
					Field({ label: "Amount", value: `+${formatNumber(amount)}` }),
					Field({ label: "Type", value: "One-off (no reset)" }),
				]),
				Text(`_Requested by ${event.user.fullName || event.user.userId}_`),
				Actions([
					Button({
						id: "confirm",
						label: "Confirm",
						style: "primary",
						value: JSON.stringify({
							action: "create_balance",
							customerId,
							featureId,
							amount,
						}),
					}),
					Button({ id: "cancel", label: "Cancel" }),
				]),
			],
		}),
	);
});
