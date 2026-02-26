import type { SlashCommandEvent } from "chat";
import { Actions, Card, LinkButton, CardText as Text } from "chat";
import { getEnv } from "@/config";
import { isSlackNotInChannel } from "@/lib/slack";
import { getWorkspace } from "@/services/workspace";

export async function handleConnectCommand(
	event: SlashCommandEvent,
	workspaceId: string,
): Promise<void> {
	const existing = await getWorkspace(workspaceId);
	if (existing) {
		const canManageConnection = existing.installedBy === event.user.userId;
		const organizationName = existing.orgName || existing.orgSlug || "this organization";

		if (!canManageConnection) {
			await event.channel.postEphemeral(
				event.user,
				`Autumn is already connected to *${organizationName}*. Only the admin who connected it can reconnect. Ask them to run \`/disconnect\` first.`,
				{ fallbackToDM: true },
			);
			return;
		}

		await event.channel.postEphemeral(
			event.user,
			`Autumn is already connected to *${organizationName}*. Run \`/disconnect\` first, then \`/connect\` again.`,
			{ fallbackToDM: true },
		);
		return;
	}

	const env = getEnv();
	const connectUrl = `${env.BASE_URL}/connect?workspace_id=${workspaceId}&user_id=${event.user.userId}&channel_id=${event.channel.id}`;

	try {
		await event.channel.post(
			Card({
				title: "",
				children: [
					Text("*Autumn Commands*"),
					Text("To connect to Autumn, click the button below and complete the browser flow."),
					Text("When you're done, return to Slack and mention @Autumn to get started."),
					Actions([LinkButton({ label: "Connect Autumn", url: connectUrl, style: "primary" })]),
				],
			}),
		);
	} catch (err) {
		if (!isSlackNotInChannel(err)) throw err;
		await event.channel.postEphemeral(
			event.user,
			"Invite Autumn to this channel first, then try again.",
			{ fallbackToDM: true },
		);
	}
}
