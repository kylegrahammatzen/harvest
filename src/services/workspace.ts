import { getEnv } from "@/config";
import { getRedis } from "@/lib/redis";
import { decrypt, encrypt } from "@/services/encryption";

export type WorkspaceConfig = {
	workspaceId: string;
	autumnApiKey: string;
	environment: "sandbox" | "live";
	orgSlug: string;
	orgName: string;
	commandChannels: string[];
	alertChannel: string | null;
	slackBotToken: string | null;
	installedAt: number;
	installedBy: string;
};

const KEY_PREFIX = "autumn:workspace:";

export async function getWorkspace(workspaceId: string): Promise<WorkspaceConfig | null> {
	const redis = getRedis();
	const data = await redis.get(`${KEY_PREFIX}${workspaceId}`);
	if (!data) return null;

	const workspace = JSON.parse(data) as WorkspaceConfig;

	workspace.autumnApiKey = await decrypt(workspace.autumnApiKey, getEnv().ENCRYPTION_KEY);

	return workspace;
}

export async function saveWorkspace(workspace: WorkspaceConfig): Promise<void> {
	const redis = getRedis();
	const env = getEnv();

	const toStore: WorkspaceConfig = {
		...workspace,
		autumnApiKey: await encrypt(workspace.autumnApiKey, env.ENCRYPTION_KEY),
	};

	await redis.set(`${KEY_PREFIX}${workspace.workspaceId}`, JSON.stringify(toStore));
}

export async function updateWorkspace(
	workspaceId: string,
	updates: Partial<Pick<WorkspaceConfig, "commandChannels" | "alertChannel">>,
): Promise<void> {
	const workspace = await getWorkspace(workspaceId);
	if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

	const updated = { ...workspace, ...updates };

	await saveWorkspace(updated);
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
	const redis = getRedis();
	await redis.del(`${KEY_PREFIX}${workspaceId}`);
}

export async function listWorkspaces(): Promise<string[]> {
	const redis = getRedis();
	const keys = await redis.keys(`${KEY_PREFIX}*`);
	return keys.map((k) => k.replace(KEY_PREFIX, ""));
}

export function isCommandChannel(workspace: WorkspaceConfig, channelId: string): boolean {
	if (workspace.commandChannels.length === 0) return true;
	return workspace.commandChannels.includes(channelId);
}
