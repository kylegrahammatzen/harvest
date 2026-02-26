import type { CardChild } from "chat";
import { Card, Divider, CardText as Text } from "chat";
import type { RenewalEntry } from "@/services/renewals";
import { formatDate, formatRelativeTime } from "@/utils/formatters";

type RenewalCardProps = {
	renewals: RenewalEntry[];
	period: string;
};

export function RenewalCard({ renewals, period }: RenewalCardProps) {
	if (renewals.length === 0) {
		return Card({
			title: `Upcoming Renewals (${period})`,
			children: [Text("No upcoming renewals in this period.")],
		});
	}

	const children: CardChild[] = [Text(`*${renewals.length}* customers renewing:`), Divider()];

	for (const r of renewals) {
		children.push(
			Text(
				`* *${r.customerName || r.customerId}* -- ${r.planName} -- ${formatDate(r.renewsAt)} (${formatRelativeTime(r.renewsAt)})`,
			),
		);
	}

	return Card({ title: `Upcoming Renewals (${period})`, children });
}
