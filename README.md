# KZ Dashboard

A simple dashboard for Counter-Strike KZ stats, maps, records and player data.

Currently built around **CS2KZ**, with plans to add support for legacy **CS:GO KZ** and eventually turn it into a more complete all-in-one KZ panel.

## Features

- Browse CS2KZ maps and courses
- Search and filter maps by tier
- View map leaderboards and records
- View player profiles and completion stats
- Track unfinished maps and courses
- Global rating leaderboard
- World record leaderboard
- Steam avatars and workshop map images
- Responsive dark UI

More features and CS:GO support are planned.

## Tech

- Next.js
- TypeScript
- CSS
- CS2KZ API

## Running locally

```bash
git clone https://github.com/lukewae/kz-dashboard.git
cd kz-dashboard
npm install
npm run dev
```

Then open:

`http://localhost:3000`

## Build

```bash
npm run build
npm start
```

## Deployment

The project is intended to be deployed on Vercel.

Push the repo to GitHub, import it into Vercel and deploy it as a Next.js project.

## API

CS2 data currently comes from the public CS2KZ API:

- https://api.cs2kz.org
- https://docs.cs2kz.org/api/

## Plans

The goal is to keep expanding this into an all-in-one KZ dashboard, including:

- CS:GO KZ support
- More player stats
- Better record and leaderboard tracking
- More map information
- Progression and comparison tools
