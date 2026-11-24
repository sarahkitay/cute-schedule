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
    res.status(500).json({ error: "Server missing PROYOU_API_KEY" });
    return null;
  }
  if (!token || token !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return token;
}

function inboxKey(token) {
  return `proyou:inbox:${token.slice(0, 24)}`;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = assertAuth(req, res);
  if (!token) return;

  try {
    const key = inboxKey(token);

    if (req.method === "GET") {
      const inbox = (await kv.get(key)) || [];
      const tasks = Array.isArray(inbox) ? inbox : [];
      return res.status(200).json({ ok: true, tasks, pendingCount: tasks.length });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const inbox = (await kv.get(key)) || [];
      const tasks = Array.isArray(inbox) ? inbox : [];

      if (body.action === "peek") {
        return res.status(200).json({ ok: true, tasks, pendingCount: tasks.length });
      }

      if (body.action === "claim" || body.claim === true) {
        const ids = Array.isArray(body.ids) ? body.ids.map(String) : null;
        let claimed;
        let remaining;
        if (ids && ids.length) {
          const idSet = new Set(ids);
          claimed = tasks.filter((t) => idSet.has(String(t.id)));
          remaining = tasks.filter((t) => !idSet.has(String(t.id)));
        } else {
          claimed = tasks;
          remaining = [];
        }
        await kv.set(key, remaining);
        return res.status(200).json({ ok: true, claimed, pendingCount: remaining.length });
      }

      if (body.action === "clear") {
        await kv.set(key, []);
        return res.status(200).json({ ok: true, pendingCount: 0 });
      }

      return res.status(400).json({ error: "Use action: claim | peek | clear" });
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("schedule/inbox error", e);
    return res.status(500).json({ error: "Inbox failed", detail: String(e?.message || e).slice(0, 240) });
  }
}
