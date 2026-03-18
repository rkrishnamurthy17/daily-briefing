export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured." });
  }

  const { calendarUrl, emailContext, date, dayName } = req.body || {};

  // Optionally fetch and parse ICS calendar data
  let calendarText = "";
  if (calendarUrl && calendarUrl.startsWith("https://")) {
    try {
      const icsResp = await fetch(calendarUrl);
      if (icsResp.ok) {
        const icsRaw = await icsResp.text();
        calendarText = parseICS(icsRaw, date);
      }
    } catch {
      calendarText = "Could not fetch calendar.";
    }
  }

  const userContent = `
Today is ${dayName}, ${date}.

${calendarText ? `CALENDAR DATA:\n${calendarText}` : "No calendar data provided."}

${emailContext ? `EMAIL CONTEXT:\n${emailContext}` : "No email context provided."}

Generate my morning briefing.
`.trim();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are a concise personal assistant generating a structured morning briefing.

Respond ONLY with a single valid JSON object. No explanation, no markdown fences:

{
  "events": [{"time": "9:00 AM", "title": "...", "duration": "1 hr"}],
  "email_highlights": [{"from": "Name", "subject": "...", "summary": "One sentence.", "action_needed": true}],
  "action_items": ["...", "...", "..."],
  "morning_note": "A warm, specific 2-sentence note about the day ahead based on the data."
}

Rules:
- Derive events from calendar data. If no calendar data, return empty array.
- Derive email_highlights from email context. If none, return empty array.
- Keep action_items to 3–5 specific items drawn from the real data.
- morning_note should feel personal and grounding, not generic.
- Return ONLY the JSON object. No other text.`,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Anthropic API error" });
    }

    const textBlocks = (data.content || []).filter((b) => b.type === "text");
    if (!textBlocks.length) {
      return res.status(500).json({ error: "No content returned from Claude." });
    }

    let raw = textBlocks[textBlocks.length - 1].text.trim();
    raw = raw.replace(/^```(?:json)?|```$/gm, "").trim();

    let briefing;
    try {
      briefing = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) briefing = JSON.parse(match[0]);
      else return res.status(500).json({ error: "Could not parse briefing response." });
    }

    return res.status(200).json(briefing);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unexpected server error." });
  }
}

// Minimal ICS parser — extracts today's events
function parseICS(icsText, targetDate) {
  const events = [];
  const blocks = icsText.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const summary = extractField(block, "SUMMARY");
    const dtstart = extractField(block, "DTSTART");
    const dtend   = extractField(block, "DTEND");

    if (!summary || !dtstart) continue;

    // Check if event is today (handles YYYYMMDD and YYYYMMDDTHHmmssZ formats)
    const eventDate = dtstart.replace(/T.*/, "");
    const formatted = targetDate.replace(/-/g, "");
    if (!eventDate.startsWith(formatted)) continue;

    const startTime = formatTime(dtstart);
    const duration  = calcDuration(dtstart, dtend);
    events.push(`- ${startTime}: ${summary}${duration ? ` (${duration})` : ""}`);
  }

  return events.length
    ? `Today's events:\n${events.join("\n")}`
    : "No events found for today in calendar.";
}

function extractField(block, field) {
  const match = block.match(new RegExp(`${field}(?:;[^:]+)?:([^\r\n]+)`));
  return match ? match[1].trim() : null;
}

function formatTime(dtStr) {
  if (!dtStr.includes("T")) return "All day";
  try {
    const d = new Date(
      dtStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/, "$1-$2-$3T$4:$5:$6Z")
    );
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  } catch {
    return "—";
  }
}

function calcDuration(start, end) {
  if (!start.includes("T") || !end || !end.includes("T")) return null;
  try {
    const s = new Date(start.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/, "$1-$2-$3T$4:$5:$6Z"));
    const e = new Date(end.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/, "$1-$2-$3T$4:$5:$6Z"));
    const mins = Math.round((e - s) / 60000);
    if (mins <= 0) return null;
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem ? `${hrs} hr ${rem} min` : `${hrs} hr`;
  } catch {
    return null;
  }
}
