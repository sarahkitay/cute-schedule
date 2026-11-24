import { kv } from "../lib/redisClient.js";
import { applyApiCors } from "../lib/cors.js";

function applyCors(req, res) {
  applyApiCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-ProYou-Token");
  res.setHeader("Content-Type", "application/json");
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const header = req.headers["x-proyou-token"];
  if (header) return String(header).trim();
  if (req.query?.token) return String(req.query.token).trim();
  if (req.body?.token) return String(req.body.token).trim();
  return "";
}

function assertAuth(req, res) {
  const expected = process.env.PROYOU_API_KEY;
  const token = getToken(req);
  if (!expected) {
    res.status(500).json({
      error: "Server missing PROYOU_API_KEY",
      hint: "Add PROYOU_API_KEY in Vercel env, then use that value as Bearer token in ChatGPT/Claude Actions.",
    });
    return null;
  }
  if (!token || token !== expected) {
    res.status(401).json({ error: "Unauthorized. Pass Authorization: Bearer <PROYOU_API_KEY>." });
    return null;
  }
  return token;
}

function inboxKey(token) {
  return `proyou:inbox:${token.slice(0, 24)}`;
}

function normalizeTask(t) {
  if (!t || typeof t !== "object") return null;
  const text = String(t.text || t.title || "").trim();
  if (!text) return null;
  const dayKey = String(t.dayKey || t.date || "").trim() || null;
  const hourRaw = String(t.hour || t.time || "09:00").trim();
  let hour = hourRaw;
  const ampm = hourRaw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
    if (ampm[3].toLowerCase() === "pm" && h < 12) h += 12;
    if (ampm[3].toLowerCase() === "am" && h === 12) h = 0;
    hour = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  } else if (/^\d{1,2}:\d{2}$/.test(hourRaw)) {
    const [h, m] = hourRaw.split(":");
    hour = `${String(parseInt(h, 10)).padStart(2, "0")}:${m}`;
  }
  return {
    id: t.id || `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    dayKey,
    hour,
    category: String(t.category || "Personal").trim() || "Personal",
    days: t.days || t.repeat || null,
    repeatWeekdays: Array.isArray(t.repeatWeekdays) ? t.repeatWeekdays : null,
  };
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = assertAuth(req, res);
  if (!token) return;

  try {
    if (req.method === "GET") {
      const dayKey = req.query?.dayKey ? String(req.query.dayKey) : null;
      const inbox = (await kv.get(inboxKey(token))) || [];
      const pending = Array.isArray(inbox) ? inbox : [];
      const filtered = dayKey ? pending.filter((t) => t.dayKey === dayKey) : pending;
      return res.status(200).json({
        ok: true,
        pendingCount: filtered.length,
        tasks: filtered,
        hint: "Open PROYOU — it pulls these into your calendar automatically when inbox sync is on.",
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const incoming = Array.isArray(body.tasks) ? body.tasks : body.task ? [body.task] : [];
      if (!incoming.length) {
        return res.status(400).json({
          error: "Provide tasks: [{ text, hour, dayKey }] or [{ text, hour, days: 'every day this week' }]",
        });
      }

      const normalized = incoming.map(normalizeTask).filter(Boolean);
      if (!normalized.length) {
        return res.status(400).json({ error: "No valid tasks (each needs text)" });
      }

      const existing = (await kv.get(inboxKey(token))) || [];
      const list = Array.isArray(existing) ? existing : [];
      const stamped = normalized.map((t) => ({
        ...t,
        source: body.source || "chatgpt",
        createdAt: new Date().toISOString(),
      }));
      const next = [...list, ...stamped].slice(-500);
      await kv.set(inboxKey(token), next);

      return res.status(200).json({
        ok: true,
        added: stamped.length,
        pendingCount: next.length,
        tasks: stamped,
        message: `Queued ${stamped.length} task(s) for PROYOU.`,
      });
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("schedule/tasks error", e);
    return res.status(500).json({ error: "Failed to update schedule inbox", detail: String(e?.message || e).slice(0, 240) });
  }
}
