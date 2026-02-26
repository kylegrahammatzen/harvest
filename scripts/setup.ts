import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

function log(msg: string) {
	console.log(`  ${msg}`);
}

function header(msg: string) {
	console.log(`\n${msg}`);
}

function exec(cmd: string, opts?: { silent?: boolean }) {
	return execSync(cmd, {
		cwd: root,
		stdio: opts?.silent ? "pipe" : "inherit",
		encoding: "utf-8",
	});
}

function checkPrerequisites() {
	header("Checking prerequisites...");

	try {
		execSync("docker info", { stdio: "ignore" });
		log("Docker is running");
	} catch {
		console.error("Docker is not running. Start Docker Desktop and try again.");
		process.exit(1);
	}

	if (!existsSync(join(root, "node_modules"))) {
		console.error("node_modules not found. Run `bun install` first.");
		process.exit(1);
	}
	log("Dependencies installed");
}

function startDocker() {
	header("Starting Redis...");

	try {
		exec("docker compose -f docker-compose.dev.yml up -d");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);

		if (msg.includes("port is already allocated")) {
			log("Port 6379 is already in use");
			log("Trying to connect to existing Redis...");

			try {
				exec("docker run --rm redis:8-alpine redis-cli -h host.docker.internal ping", {
					silent: true,
				});
				log("Existing Redis is reachable, continuing");
				return;
			} catch {
				console.error("Port 6379 is taken but Redis isn't responding on it.");
				console.error("Stop whatever is using port 6379 and try again.");
				process.exit(1);
			}
		}

		console.error("Failed to start Docker services:");
		console.error(msg);
		process.exit(1);
	}
}

function waitForHealthy(container: string, timeoutMs = 30_000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const status = execSync(`docker inspect --format={{.State.Health.Status}} ${container}`, {
				encoding: "utf-8",
			}).trim();
			if (status === "healthy") return;
		} catch {}
		Bun.sleepSync(2000);
	}
	console.error(`${container} failed to become healthy within ${timeoutMs / 1000}s`);
	process.exit(1);
}

function waitForServices() {
	header("Waiting for Redis to be ready...");
	try {
		waitForHealthy("autumn-redis");
		log("Redis is healthy");
	} catch {
		log("Could not check container health, verifying Redis connection...");
		try {
			exec("docker run --rm redis:8-alpine redis-cli -h host.docker.internal ping", {
				silent: true,
			});
			log("Redis is reachable");
		} catch {
			console.error("Redis is not reachable. Check your Docker setup.");
			process.exit(1);
		}
	}
}

function createEnvFile() {
	header("Setting up environment...");

	const envPath = join(root, ".env");
	const examplePath = join(root, ".env.example");

	if (existsSync(envPath)) {
		log(".env already exists, skipping");
		return;
	}

	if (!existsSync(examplePath)) {
		console.error(".env.example not found");
		process.exit(1);
	}

	let content = readFileSync(examplePath, "utf-8");

	const encryptionKey = randomBytes(32).toString("hex");
	content = content.replace("ENCRYPTION_KEY=", `ENCRYPTION_KEY=${encryptionKey}`);

	writeFileSync(envPath, content);
	log("Created .env with generated ENCRYPTION_KEY");
	log("Edit .env to add your Slack and Autumn credentials");
}

function printNextSteps() {
	header("Setup complete!\n");
	console.log("Next steps:\n");
	console.log("  1. Create a Slack app at https://api.slack.com/apps");
	console.log("     Copy Bot Token and Signing Secret to .env\n");
	console.log("  2. Add your ANTHROPIC_API_KEY to .env (for the AI agent)\n");
	console.log("  3. Start the dev server:");
	console.log("     bun dev\n");
	console.log("  4. Expose with a tunnel:");
	console.log("     ngrok http 31448\n");
	console.log("  5. Update Slack Event Subscriptions URL to:");
	console.log("     https://<tunnel>/webhooks/slack\n");
	console.log("  6. Validate/deploy Slack manifest:");
	console.log("     bun run slack:manifest:validate");
	console.log("     SLACK_APP_ID=<your-app-id> bun run slack:manifest:deploy\n");
}

checkPrerequisites();
startDocker();
waitForServices();
createEnvFile();
printNextSteps();
