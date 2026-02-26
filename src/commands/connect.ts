import type { SlashCommandEvent } from "chat";
import { Actions, Card, LinkButton, CardText as Text } from "chat";
import { getEnv } from "@/config";
import { postPrivate, postPublic } from "@/lib/command";
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
			await postPrivate(
				event,
				`Autumn is already connected to *${organizationName}*. Only the admin who connected it can reconnect. Ask them to run \`/disconnect\` first.`,
			);
			return;
		}

		await postPrivate(
			event,
			`Autumn is already connected to *${organizationName}* (${existing.environment}). Run \`/disconnect\` first, then \`/connect\` again.`,
		);
		return;
	}

	const env = getEnv();
	const connectUrl = `${env.BASE_URL}/connect?workspace_id=${workspaceId}&user_id=${event.user.userId}`;

	await postPublic(
		event,
		Card({
			title: "",
			children: [
				Text("*Autumn Commands*"),
				Text("To connect to Autumn, click the button below and complete the browser flow."),
				Text("When you're done, return to Slack and run `/customer <id>`."),
				Actions([LinkButton({ label: "Connect Autumn", url: connectUrl, style: "primary" })]),
			],
		}),
	);
}
