import { createSlackAdapter } from "@chat-adapter/slack";
import { createRedisState } from "@chat-adapter/state-redis";
import { Chat } from "chat";
import { handleCancelAction, handleConfirmAction } from "@/agent/confirm";
import { handleAgentMention, handleAgentMessage } from "@/agent/handler";
import { handleSlashCommandByName } from "@/commands/router";
import { getWorkspace, listWorkspaces } from "@/services/workspace";

export const slackAdapter = createSlackAdapter({
	clientId: process.env.SLACK_CLIENT_ID,
	clientSecret: process.env.SLACK_CLIENT_SECRET,
});

export const bot = new Chat({
	userName: "autumn",
	logger: "warn",
	adapters: { slack: slackAdapter },
	state: createRedisState(),
});

bot.onSlashCommand(async (event) => {
	await handleSlashCommandByName(event);
});

bot.onNewMessage(/@Autumn/i, async (thread, message) => {
	await handleAgentMention(thread, message);
});

bot.onSubscribedMessage(async (thread, message) => {
	await handleAgentMessage(thread, message);
});

bot.onAction("confirm", async (event) => {
	await handleConfirmAction(event);
});

bot.onAction("cancel", async (event) => {
	await handleCancelAction(event);
});

bot.onAssistantThreadStarted(async (event) => {
	try {
		await slackAdapter.setSuggestedPrompts(event.channelId, event.threadTs, [
			{ title: "Customer lookup", message: "What plan is customer acme on?" },
			{ title: "Usage check", message: "Show me usage for customer acme" },
			{ title: "Attach a plan", message: "Attach the Pro plan to customer acme" },
		]);
	} catch (err) {
		console.error("assistant_thread_started error:", err);
	}
});

bot.onAppHomeOpened(async (event) => {
	try {
		const workspaceIds = await listWorkspaces();
		const workspace = workspaceIds.length === 1 ? await getWorkspace(workspaceIds[0]) : null;
		const slack = bot.getAdapter("slack");

		const blocks: Record<string, unknown>[] = [];

		if (workspace?.orgName) {
			blocks.push(
				{ type: "header", text: { type: "plain_text", text: "Autumn" } },
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `*Connected to:* ${workspace.orgName}`,
					},
				},
				{ type: "divider" },
			);
		} else {
			blocks.push(
				{ type: "header", text: { type: "plain_text", text: "Autumn" } },
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: "Not connected yet. Run `/connect` in any channel to get started.",
					},
				},
				{ type: "divider" },
			);
		}

		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: '*Getting Started*\nMention `@Autumn` in any channel to ask about customers, subscriptions, usage, and billing.\n\nExamples:\n- "What plan is acme on?"\n- "Grant acme 5000 messages"\n- "Show upcoming renewals"',
			},
		});

		await slack.publishHomeView(event.userId, { type: "home", blocks });
	} catch (err) {
		console.error("app_home_opened error:", err);
	}
});
