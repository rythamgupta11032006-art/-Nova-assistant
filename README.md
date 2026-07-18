# Nova — White-Label Personal Assistant Chatbot

A full-stack personal assistant chatbot: chat interface, task manager, and
notes, backed by a real database and the Claude API. Built so you (or
whoever buys it from you) can rebrand it in minutes and deploy it for
a client.

## What's inside

```
assistant-bot/
├── server.js          Express API (chat, tasks, notes, users)
├── database.js        SQLite schema (auto-creates on first run)
├── config/
│   └── branding.json  Everything a buyer edits to rebrand the bot
├── public/
│   ├── index.html
│   ├── style.css       Ink/parchment/gold theme, all colors are variables
│   └── app.js
├── .env.example
└── package.json
```

Features:
- Persistent chat history (SQLite, no external DB needed)
- Task list with due dates and completion tracking
- Notes
- The assistant is aware of the user's open tasks and recent notes when it replies
- One JSON file controls the entire brand identity (name, colors, logo, tone, welcome message)

## Running it locally

```bash
npm install
cp .env.example .env
# edit .env and add your ANTHROPIC_API_KEY from console.anthropic.com
npm start
```

Then open `http://localhost:3000`.

## White-labeling for a client (this is the whole business model)

Everything a buyer needs to touch lives in **`config/branding.json`**:

```json
{
  "botName": "Nova",
  "companyName": "Your Company",
  "tagline": "Your personal assistant, always on.",
  "primaryColor": "#1B2A3B",
  "accentColor": "#C89B4C",
  "backgroundColor": "#FBF9F5",
  "logoUrl": "",
  "welcomeMessage": "...",
  "systemPrompt": "..."
}
```

Change the name, colors, logo URL, and the `systemPrompt` (this shapes the
assistant's personality — e.g. make it a real-estate assistant, a fitness
coach, a study buddy) and the whole app rebrands instantly, no code
changes. This is the core of what you're selling: the same engine, a new
face each time.

## Deploying for a client

Cheapest/simplest paths, in order of effort:
1. **Render.com** or **Railway.app** — connect the repo, set the
   `ANTHROPIC_API_KEY` env var, done. Both have free/low tiers good enough
   for a small client.
2. **A $5-6/month VPS** (DigitalOcean, Hetzner) if you want to host many
   clients yourself and charge monthly.
3. **The client's own server**, if you're selling the code outright rather
   than hosting it.

Each client should get their own `branding.json` and ideally their own
`ANTHROPIC_API_KEY` (or you meter usage and bill them if you're hosting).

## Where to sell this

Since you're targeting **freelancers and agencies who will white-label and
resell it**, sell one level up from end users — sell to the people who sell
to businesses:

- **Gumroad / Lemon Squeezy** — list it as a "white-label AI assistant
  starter kit" with a demo video. Good for one-time code sales ($49–$299
  depending on how much you package: just the code vs. code + deployment
  service).
- **Flippa / Acquire.com** — if you want to sell it as a small SaaS/asset
  rather than a one-off script.
- **Upwork / Fiverr** — offer it as a *productized service*: "I'll set up
  a branded AI assistant for your agency's clients" — this sells the
  service around the code, not just the code.
- **Indie Hackers / r/SaaS / r/agency / r/Entrepreneur** — post the
  build process or a case study; agency owners lurk there looking for
  exactly this kind of white-label tool.
- **AppSumo** (for the "lifetime deal" crowd) if you turn it into a
  hosted multi-tenant SaaS rather than a code sale — bigger lift, bigger
  reach.
- **Direct outreach** — small marketing/consulting/coaching agencies on
  LinkedIn who already sell "AI implementation" to their clients but
  don't build in-house. They're your best buyers: they need the product,
  not the code.

### Who's actually buying
- Small marketing/consulting agencies wanting a client add-on service
- Freelance developers who want a head start instead of building from scratch
- Coaches/consultants who want to offer their own clients a "digital assistant" under their own brand

### How to price it
- Code license (one-time): $99–$499 depending on how "done" it is
  (add deployment scripts, a demo video, and support and you can charge more)
- Setup service (you brand + deploy it for them): $150–$500 per client
- Ongoing hosting + support retainer: $20–$50/month per client if you host it for them

## Next steps you could add before selling
- Real authentication (currently uses a simple name/email lookup — fine
  for a demo, not for production)
- Stripe billing if you go the hosted-SaaS route
- Calendar/email integrations (Google Calendar, Gmail) — the biggest
  feature upgrade requests will come from here
