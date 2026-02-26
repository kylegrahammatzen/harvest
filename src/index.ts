import { Hono } from "hono";
import { logger } from "hono/logger";
import { bot } from "@/bot";
import { getEnv } from "@/config";
import { autumnWebhookRoutes } from "@/routes/autumn";
import { connectRoutes } from "@/routes/connect";
import { installRoutes } from "@/routes/install";
import { webhookRoutes } from "@/routes/webhooks";
import { listWorkspaces } from "@/services/workspace";

const app = new Hono();

app.use("*", logger());

app.get("/", (c) => c.json({ name: "autumn", status: "ok" }));
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/favicon.ico", (c) => c.body(null, 204));

app.route("/webhooks", webhookRoutes);
app.route("/autumn/webhooks", autumnWebhookRoutes);
app.route("/", installRoutes);
app.route("/connect", connectRoutes);

const env = getEnv();

bot
	.initialize()
	.then(() => listWorkspaces())
	.then((ids) =>
		console.log(
			`Autumn Slack bot running on port ${env.PORT} (${ids.length} workspace${ids.length === 1 ? "" : "s"})`,
		),
	)
	.catch(() => console.log(`Autumn Slack bot running on port ${env.PORT} (no Redis)`));

export default {
	port: env.PORT,
	fetch: app.fetch,
};
