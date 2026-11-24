import { applyApiCors } from "./lib/cors.js";

/** Dynamic OpenAPI for ChatGPT / Claude Custom Actions */
export default async function handler(req, res) {
  applyApiCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ error: "GET only" });
  }

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const base = `${proto}://${host}`;

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "PROYOU Schedule API",
      description:
        "Add tasks to PROYOU from ChatGPT or Claude. Queue tasks here; they sync into the app when PROYOU is open with inbox sync enabled. Use dayKey YYYY-MM-DD and hour HH:MM (or 8am). For repeats, set days to phrases like 'every day this week', 'weekdays', or 'mon wed fri', or pass repeatWeekdays as [0-6].",
      version: "1.0.0",
    },
    servers: [{ url: base, description: "This PROYOU deployment" }],
    paths: {
      "/api/schedule/tasks": {
        get: {
          operationId: "listPendingTasks",
          summary: "List tasks queued for PROYOU",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "dayKey",
              in: "query",
              required: false,
              schema: { type: "string", example: "2026-11-24" },
            },
          ],
          responses: {
            "200": {
              description: "Pending inbox tasks",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      pendingCount: { type: "integer" },
                      tasks: { type: "array", items: { $ref: "#/components/schemas/Task" } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: "addScheduleTasks",
          summary: "Queue tasks into PROYOU",
          description:
            "Build a day or week by posting multiple tasks. Prefer concrete dayKey values when you know dates; otherwise use days phrases or repeatWeekdays.",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["tasks"],
                  properties: {
                    source: { type: "string", example: "chatgpt" },
                    tasks: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TaskInput" },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Tasks queued",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      added: { type: "integer" },
                      pendingCount: { type: "integer" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "PROYOU_API_KEY from Vercel env / PROYOU Settings",
        },
      },
      schemas: {
        TaskInput: {
          type: "object",
          required: ["text"],
          properties: {
            text: { type: "string" },
            hour: { type: "string", example: "08:00" },
            dayKey: { type: "string", example: "2026-11-24" },
            days: { type: "string", example: "every day this week" },
            repeatWeekdays: {
              type: "array",
              items: { type: "integer", minimum: 0, maximum: 6 },
              description: "0=Sun … 6=Sat",
            },
            category: { type: "string", example: "Personal" },
          },
        },
        Task: {
          allOf: [
            { $ref: "#/components/schemas/TaskInput" },
            {
              type: "object",
              properties: {
                id: { type: "string" },
                createdAt: { type: "string" },
              },
            },
          ],
        },
      },
    },
  };

  res.setHeader("Content-Type", "application/json");
  return res.status(200).json(spec);
}
