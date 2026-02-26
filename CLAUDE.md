# Harvest

Harvest is Autumn's Slack automation engine. It provides slash commands, webhook-driven alerts, and an AI agent for managing billing operations through chat.

## Tech Stack

- Runtime: Bun
- Server: Hono
- Bot Framework: Chat SDK (`chat`, `@chat-adapter/slack`)
- State: Redis (via `@chat-adapter/state-redis` + `ioredis`)
- Billing API: `autumn-js@beta` (Autumn v2 SDK)
- AI Agent: Anthropic Claude (via `@anthropic-ai/sdk`)
- Webhook Verification: Svix

## Architecture

```
src/
├── index.ts           Hono server entry point
├── bot.ts             Chat SDK instance and event handlers
├── config.ts          Env validation
├── routes/
│   ├── webhooks.ts    Chat SDK webhook handler (/webhooks/slack)
│   ├── autumn.ts      Autumn webhook receiver (/autumn/webhooks)
│   └── install.ts     Slack OAuth flow (/install/slack)
├── commands/
│   ├── router.ts      /autumn <subcommand> parser
│   ├── connect.ts     /autumn connect (OTP onboarding)
│   ├── customer.ts    /autumn customer <id>
│   ├── usage.ts       /autumn usage <id>
│   ├── balance.ts     /autumn balance <id> <feature> <amount>
│   ├── checkout.ts    /autumn checkout <id> <plan>
│   └── renewals.ts    /autumn upcoming-renewals <period>
├── alerts/
│   └── router.ts      Route Autumn webhook events to alert cards
├── agent/
│   ├── handler.ts     onNewMention + onSubscribedMessage -> Claude
│   ├── tools.ts       Tool definitions for Claude
│   ├── executor.ts    Tool execution (read + computed)
│   └── confirm.ts     Confirmation flow for mutating tools
├── cards/
│   ├── customer.ts    Customer info card
│   ├── usage.ts       Usage breakdown card
│   ├── alert.ts       Alert notification cards
│   └── renewal.ts     Renewal list card
├── services/
│   ├── autumn.ts      Per-tenant Autumn SDK factory
│   ├── workspace.ts   Redis workspace credential store
│   └── encryption.ts  AES-256-GCM encryption for API keys
└── utils/
    └── formatters.ts  Formatters
```

## Multi-Tenant

Each Slack workspace stores credentials encrypted in Redis. On every event, the workspace is resolved, credentials are decrypted, and a per-tenant Autumn SDK instance is created. Channel-based access control restricts where commands and the agent operate.

## Auth

Users connect via `/autumn connect` which triggers Autumn's OTP flow (same as `atmn login`). No API keys are pasted in chat.

## Commands

- `bun setup` -- Docker + Redis + env setup
- `bun dev` -- Start dev server with hot reload
- `bun start` -- Start production server
- `bun run check` -- Lint and format check
- `bun run typecheck` -- TypeScript type checking

## Style

- Biome for formatting (tabs, double quotes, semicolons)
- Chat SDK function-call API for cards (no JSX)
- `.ts` extensions only
- No doc comments, no decorative comment separators
