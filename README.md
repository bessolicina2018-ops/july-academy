# July Academy

Real accounts + private database (Supabase), built to deploy on Vercel.

## Before deploying

1. You already ran `schema.sql` in Supabase and turned on Anonymous sign-ins — done.
2. You need an Anthropic API key so AI homework feedback keeps working outside of Claude:
   - Go to https://console.anthropic.com, create an account, add a small amount of credit.
   - Create an API key under "API Keys."
   - You'll paste this into Vercel as an environment variable called `ANTHROPIC_API_KEY` (see below) — never put it in the code itself.

## Deploy on Vercel

1. Push this folder to a GitHub repository (or use Vercel's CLI — ask me if you'd rather do it that way).
2. Go to vercel.com, sign up/log in, click "Add New… → Project," and import the repository.
3. Before clicking Deploy, open "Environment Variables" and add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: (paste your key from console.anthropic.com)
4. Click Deploy. In a minute or two you'll get a live link like `july-academy.vercel.app`.

That's it — the Supabase URL and key are already in the code (they're the public/publishable kind, safe to be there).

## Local testing (optional)

```
npm install
npm run dev
```

This runs the app on your computer at http://localhost:5173 — but the AI feedback feature won't work locally unless you also run `vercel dev` (which reads the environment variable) instead of `npm run dev`.
