# Harvest - Contributing

## Development Setup

Prerequisites:
- Bun 1.3+
- Redis (local or Docker)
- A Slack app with bot token and signing secret

Getting started:
```bash
git clone https://github.com/useautumn/harvest.git
cd harvest
cp .env.example .env
bun install
bun dev
```

For local Slack testing, use a tunnel like ngrok and update your Slack app's Event Subscriptions and Interactivity Request URLs.

Running checks:
```bash
bun run typecheck
bun run check
```

## Project Structure

- `src/commands/` -- slash command handlers, one file per command
- `src/agent/` -- AI agent with Claude tool-calling, tool executor, and confirmation flow
- `src/cards/` -- Slack card builders using Chat SDK's function API
- `src/alerts/` -- Autumn webhook event routing to alert cards
- `src/services/` -- Autumn SDK factory, workspace credential store, encryption
- `src/routes/` -- Hono route handlers

## Pull Requests

- Keep changes focused and atomic
- Run `bun run typecheck` and `bun run check` before submitting
- Test slash commands and agent locally with a Slack workspace

## Commit Message Format

- `feat: add customer health check command`
- `fix: handle missing balance in usage card`
- `refactor: switch to function-call card API`

## Style

- Biome for formatting (tabs, double quotes, semicolons)
- No JSX -- use Chat SDK's function-call API for cards
- No doc comments or decorative comment separators
- `.ts` extensions only

## License

By contributing, you agree your code will be licensed under the MIT License.
