import { Autumn } from "autumn-js";
import type { WorkspaceConfig } from "@/services/workspace";

export function createAutumnClient(workspace: WorkspaceConfig): Autumn {
	return new Autumn({
		secretKey: workspace.autumnApiKey,
	});
}
