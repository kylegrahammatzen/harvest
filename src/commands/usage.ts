import type { Balance } from "autumn-js";
import { UsageCard } from "@/cards/usage";
import { defineCommand, postPrivate, postPublic } from "@/lib/command";

export const usageCommand = defineCommand(async ({ event, autumn, args }) => {
	const customerId = args[0];
	if (!customerId) {
		await postPrivate(event, "Usage: `/usage <customer_id>`");
		return;
	}

	try {
		const customer = await autumn.customers.getOrCreate({ customerId });

		const features = Object.entries<Balance>(customer.balances).map(([featureId, b]) => ({
			featureId,
			featureName: b.feature?.name || featureId,
			usage: b.usage || 0,
			includedUsage: b.granted || 0,
			balance: b.remaining ?? null,
			unlimited: b.unlimited || false,
			nextResetAt: b.nextResetAt || null,
		}));

		await postPublic(
			event,
			UsageCard({
				customerId,
				customerName: customer.name,
				features,
			}),
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await postPrivate(event, `Failed to fetch customer \`${customerId}\`: ${message}`);
	}
});
