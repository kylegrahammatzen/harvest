# Harvest

Harvest is Autumn's Slack automation engine. It connects to your [Autumn](https://useautumn.com) account and gives your team:

- Slash commands for looking up customers, usage, and billing
- An AI agent (`@harvest`) for natural language billing queries
- Webhook-driven alerts for plan changes, usage thresholds, and trials
- Multi-tenant support with encrypted credential storage

## Getting Started

### Prerequisites

- Bun 1.3+
- Redis
- A Slack workspace where you can install apps
- An [Autumn](https://useautumn.com) account

### Development

```bash
git clone https://github.com/useautumn/harvest.git
cd harvest
cp .env.example .env
bun install
bun dev
```

### Local Testing

1. Start the dev server (`bun dev`)
2. Expose it with a tunnel (e.g. `ngrok http 3000`)
3. Update the Slack Event Subscriptions and Interactivity Request URLs to your tunnel URL
4. Invite the bot to a channel and try `/autumn help`

## Commands

`/autumn connect` connects your Autumn account via OTP. From there:

```
/autumn customer <id>                     Customer info, plan, balances
/autumn usage <id>                        Feature-level usage breakdown
/autumn balance <id> <feature> <amount>   Grant balance to a customer
/autumn checkout <id> <plan>              Generate a checkout URL
/autumn upcoming-renewals <period>        Customers renewing soon (7d, 14d, 30d)
```

## AI Agent

Mention `@harvest` in a configured channel to ask questions in natural language:

- "What plan is Acme on?"
- "Who's close to their message limit?"
- "Show me customers renewing in the next 7 days"

The agent has tools covering customer lookup, usage analytics, plan comparison, balance management, and more. Mutating actions require confirmation before executing.

## Webhook Alerts

Harvest receives billing events from Autumn and posts alert cards to a configured Slack channel -- plan changes, trial events, usage thresholds, and balance additions.

## Auth

Users connect via `/autumn connect` which uses Autumn's OTP flow (same as the `atmn` CLI). No API keys are pasted in chat. Credentials are stored AES-256-GCM encrypted in Redis.

During setup, teams pick which channels the bot operates in for access control.

## Architecture

```
src/
├── index.ts           Hono server entry point
├── bot.ts             Chat SDK instance and event handlers
├── config.ts          Env validation
├── routes/            Webhook handler, Autumn events, Slack OAuth
├── commands/          Slash command implementations
├── alerts/            Webhook event routing and alert cards
├── agent/             AI agent (Claude tool-calling)
├── cards/             Slack card builders
├── services/          Autumn SDK factory, workspace store, encryption
└── utils/             Formatters
```

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for development setup and guidelines.

## License

MIT License. See [LICENSE](LICENSE).
