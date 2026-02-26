import { Hono } from "hono";
import { logger } from "hono/logger";
import { getEnv } from "@/config";
import { autumnWebhookRoutes } from "@/routes/autumn";
import { connectRoutes, handleOAuthCallback } from "@/routes/connect";
import { installRoutes } from "@/routes/install";
import { webhookRoutes } from "@/routes/webhooks";

const app = new Hono();

app.use("*", logger());

app.get("/", async (c) => {
	const code = c.req.query("code");
	const state = c.req.query("state");
	const error = c.req.query("error");

	if (code || state || error) {
		return handleOAuthCallback(c);
	}

	return c.json({ name: "autumn", status: "ok" });
});
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/favicon.ico", (c) => c.body(null, 204));

app.route("/webhooks", webhookRoutes);
app.route("/autumn/webhooks", autumnWebhookRoutes);
app.route("/install", installRoutes);
app.route("/connect", connectRoutes);

const env = getEnv();
console.log(`Autumn starting on port ${env.PORT}...`);

export default {
	port: env.PORT,
	fetch: app.fetch,
};
