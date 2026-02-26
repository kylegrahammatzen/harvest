import Anthropic from "@anthropic-ai/sdk";
import type { Message, Thread } from "chat";
import { Actions, Button, Card, CardText as Text } from "chat";
import { executeTool } from "@/agent/executor";
import { agentTools, MUTATING_TOOLS } from "@/agent/tools";
import { getEnv } from "@/config";
import { getWorkspaceIdFromRaw } from "@/lib/slack";
import { createAutumnClient } from "@/services/autumn";
import { getWorkspace, listWorkspaces } from "@/services/workspace";

const SYSTEM_PROMPT = `You are Autumn, an AI billing operations assistant for Autumn (useautumn.com).
You help teams manage their customers, subscriptions, usage, and billing through Slack.

You have access to tools that interact with the Autumn billing API. Use them to answer questions and perform actions.

Important rules:
- For MUTATING tools (create_balance, set_balance, track_usage, attach_plan, update_subscription, generate_checkout_url, setup_payment, update_customer, create_referral_code, redeem_referral_code), produce a concise summary of what you're about to do. Confirm/Cancel buttons appear automatically — do NOT ask the user to confirm in text.
- For READ tools, execute them directly and present the results clearly.
- For COMPUTED tools, execute the underlying queries and synthesize the results.
- Be concise. Format responses for Slack readability (use *bold*, \`code\`, bullet points).
- When showing usage data, include relevant numbers and percentages.
- If a tool returns an error, explain it clearly and suggest next steps.

Disambiguation:
- When a user references a customer by name and multiple customers match, list the matches with their IDs and ask which one they mean before proceeding.
- Always confirm you have the right customer before executing a mutating action.`;

let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
	if (!_anthropic) {
		const apiKey = getEnv().ANTHROPIC_API_KEY;
		if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
		_anthropic = new Anthropic({ apiKey });
	}
	return _anthropic;
}

async function resolveWorkspaceId(raw: unknown): Promise<string | null> {
	const explicitWorkspaceId = getWorkspaceIdFromRaw(raw);
	if (explicitWorkspaceId) return explicitWorkspaceId;

	const workspaceIds = await listWorkspaces();
	if (workspaceIds.length === 1) return workspaceIds[0];
	return null;
}

export async function handleAgentMention(thread: Thread, message: Message): Promise<void> {
	const workspaceId = await resolveWorkspaceId(message.raw);
	if (!workspaceId) {
		await thread.post(
			"Autumn could not resolve this workspace yet, so ask an admin to run `/connect` first.",
		);
		return;
	}

	const workspace = await getWorkspace(workspaceId);

	if (!workspace) {
		await thread.post(
			"Autumn is not configured for this Slack workspace yet, so ask an admin to run `/connect`.",
		);
		return;
	}

	if (
		thread.channelId &&
		workspace.commandChannels.length > 0 &&
		!workspace.commandChannels.includes(thread.channelId)
	) {
		await thread.post(
			"Autumn mentions only work in configured channels, so ask an admin to add this channel in settings.",
		);
		return;
	}

	await thread.subscribe();
	await runAgentLoop(thread, message);
}

export async function handleAgentMessage(thread: Thread, message: Message): Promise<void> {
	const workspaceId = await resolveWorkspaceId(message.raw);
	if (!workspaceId) {
		await thread.post(
			"Autumn could not resolve this workspace yet, so ask an admin to run `/connect` first.",
		);
		return;
	}

	const workspace = await getWorkspace(workspaceId);

	if (!workspace) {
		await thread.post(
			"Autumn is not configured for this Slack workspace yet, so ask an admin to run `/connect`.",
		);
		return;
	}
	if (
		thread.channelId &&
		workspace.commandChannels.length > 0 &&
		!workspace.commandChannels.includes(thread.channelId)
	)
		return;

	await runAgentLoop(thread, message);
}

type PendingMutation = {
	toolName: string;
	toolInput: Record<string, unknown>;
};

async function runAgentLoop(thread: Thread, message: Message): Promise<void> {
	const workspaceId = await resolveWorkspaceId(message.raw);
	if (!workspaceId) return;

	const workspace = await getWorkspace(workspaceId);
	if (!workspace) return;

	const text = message.text.length > 80 ? `${message.text.slice(0, 80)}...` : message.text;
	console.log(`Agent: "${text}" (${workspace.orgName})`);

	const autumn = createAutumnClient(workspace);
	const anthropic = getAnthropic();

	try {
		await thread.startTyping().catch(() => {});

		const messages: Anthropic.MessageParam[] = [{ role: "user", content: message.text }];
		let pendingMutation: PendingMutation | null = null;

		let response = await anthropic.messages.create({
			model: "claude-sonnet-4-20250514",
			max_tokens: 4096,
			system: SYSTEM_PROMPT,
			tools: agentTools,
			messages,
		});

		while (response.stop_reason === "tool_use") {
			const toolUseBlocks = response.content.filter(
				(b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
			);

			const toolResults: Anthropic.ToolResultBlockParam[] = [];

			for (const toolUse of toolUseBlocks) {
				if (MUTATING_TOOLS.has(toolUse.name)) {
					pendingMutation = {
						toolName: toolUse.name,
						toolInput: toolUse.input as Record<string, unknown>,
					};
					toolResults.push({
						type: "tool_result",
						tool_use_id: toolUse.id,
						content: JSON.stringify({
							status: "confirmation_required",
							message:
								"This is a mutating action. Describe what you're about to do clearly and concisely. Confirm/Cancel buttons will appear automatically after your message.",
							tool_name: toolUse.name,
							params: toolUse.input,
						}),
					});
				} else {
					const result = await executeTool(
						toolUse.name,
						toolUse.input as Record<string, unknown>,
						autumn,
					);
					toolResults.push({
						type: "tool_result",
						tool_use_id: toolUse.id,
						content: JSON.stringify(result),
					});
				}
			}

			messages.push({ role: "assistant", content: response.content });
			messages.push({ role: "user", content: toolResults });

			response = await anthropic.messages.create({
				model: "claude-sonnet-4-20250514",
				max_tokens: 4096,
				system: SYSTEM_PROMPT,
				tools: agentTools,
				messages,
			});
		}

		const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
		const responseText = textBlocks.map((b) => b.text).join("\n");

		if (responseText && pendingMutation) {
			await thread.post(
				Card({
					title: "Confirm Action",
					children: [
						Text(responseText),
						Actions([
							Button({
								id: "confirm",
								label: "Confirm",
								style: "primary",
								value: JSON.stringify({
									action: pendingMutation.toolName,
									...pendingMutation.toolInput,
								}),
							}),
							Button({ id: "cancel", label: "Cancel" }),
						]),
					],
				}),
			);
		} else if (responseText) {
			await thread.post({ markdown: responseText });
		}
	} catch (err) {
		console.error("Agent error:", err);
		await thread.post("Something went wrong processing your request. Check the logs for details.");
	}
}
