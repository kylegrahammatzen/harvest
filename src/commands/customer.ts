import type { Balance } from "autumn-js";
import { CustomerCard } from "@/cards/customer";
import { defineCommand, postPrivate, postPublic } from "@/lib/command";

export const customerCommand = defineCommand(async ({ event, autumn, args }) => {
	const customerId = args[0];
	if (!customerId) {
		await postPrivate(event, "Usage: `/customer <customer_id>`");
		return;
	}

	try {
		const customer = await autumn.customers.getOrCreate({
			customerId,
			expand: ["invoices"],
		});

		const subscriptions = customer.subscriptions.map((s) => ({
			planId: s.planId,
			planName: s.plan?.name,
			status: s.status || "active",
			currentPeriodEnd: s.currentPeriodEnd || undefined,
			canceledAt: s.canceledAt || null,
			trialEnd: s.trialEndsAt || null,
		}));

		const balances = Object.entries<Balance>(customer.balances).map(([featureId, b]) => ({
			featureId,
			balance: b.remaining ?? null,
			usage: b.usage || 0,
			includedUsage: b.granted || 0,
			unlimited: b.unlimited || false,
			nextResetAt: b.nextResetAt || null,
		}));

		await postPublic(
			event,
			CustomerCard({
				customerId,
				customerName: customer.name,
				customerEmail: customer.email,
				subscriptions,
				balances,
			}),
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await postPrivate(event, `Failed to fetch customer \`${customerId}\`: ${message}`);
	}
});
