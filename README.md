# Morning Briefing Dashboard

AI-powered personal briefing that pulls your Google Calendar and analyzes emails using Claude.

## Deploy to Vercel (5 minutes)

### Step 1 — Get your Anthropic API key
1. Go to https://console.anthropic.com
2. Click **API Keys** in the sidebar
3. Click **Create Key** — copy it somewhere safe

### Step 2 — Push to GitHub
1. Create a new repo at https://github.com/new (name it `daily-briefing`)
2. Upload this entire folder (drag and drop works on GitHub)

### Step 3 — Deploy on Vercel
1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New Project** → import your `daily-briefing` repo
3. Under **Environment Variables**, add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your API key from Step 1
4. Click **Deploy** — takes about 30 seconds

Your dashboard is now live at `https://daily-briefing-[hash].vercel.app`

---

## Get your Google Calendar ICS URL

1. Open Google Calendar at https://calendar.google.com
2. Click the three dots next to your calendar → **Settings**
3. Scroll to **Integrate calendar**
4. Copy the **Secret address in iCal format** (starts with `https://calendar.google.com/calendar/ical/...`)
5. Paste it into the dashboard input field

This URL is private — don't share it publicly.

---

## Project Structure

```
daily-briefing/
  api/
    briefing.js       # Vercel serverless function (Anthropic API proxy + ICS parser)
  public/
    index.html        # Frontend dashboard
  vercel.json         # Routing config
  package.json
```

## How It Works

1. User pastes their Google Calendar ICS URL + any email context
2. Frontend calls `/api/briefing` (your Vercel serverless function)
3. The function fetches and parses the ICS calendar for today's events
4. Sends everything to Claude (Anthropic API) with your API key
5. Claude returns a structured JSON briefing
6. Frontend renders the briefing in the newspaper-style UI
