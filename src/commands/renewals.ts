import { RenewalCard } from "@/cards/renewal";
import { defineCommand, postPrivate, postPublic } from "@/lib/command";
import { findUpcomingRenewals } from "@/services/renewals";

export const renewalsCommand = defineCommand(async ({ event, autumn, args }) => {
	const periodStr = args[0] || "7d";

	const { renewals, error } = await findUpcomingRenewals(autumn, periodStr);
	if (error) {
		await postPrivate(event, `${error}\nExamples: \`7d\`, \`14d\`, \`30d\``);
		return;
	}

	await postPublic(event, RenewalCard({ renewals, period: periodStr }));
});
