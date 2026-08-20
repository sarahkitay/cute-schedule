import assert from "node:assert/strict";
import { describe, it } from "node:test";
import handler from "./nutrition-label.js";

function mockReqRes({ method = "POST", body = {}, headers = {} } = {}) {
  const resHeaders = {};
  let statusCode = 200;
  let payload = null;
  const res = {
    setHeader(k, v) {
      resHeaders[k] = v;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(obj) {
      payload = obj;
      return this;
    },
    end() {
      return this;
    },
  };
  const req = { method, body, headers, socket: {} };
  return {
    req,
    res,
    result: () => ({ statusCode, payload, resHeaders }),
  };
}

describe("POST /api/nutrition-label", () => {
  it("rejects non-POST", async () => {
    const ctx = mockReqRes({ method: "GET" });
    await handler(ctx.req, ctx.res);
    assert.equal(ctx.result().statusCode, 405);
  });

  it("handles CORS preflight", async () => {
    const ctx = mockReqRes({ method: "OPTIONS" });
    await handler(ctx.req, ctx.res);
    assert.equal(ctx.result().statusCode, 200);
  });

  it("requires OCR text or image when the model key is configured", async () => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test";
    try {
      const ctx = mockReqRes({ body: {} });
      await handler(ctx.req, ctx.res);
      assert.equal(ctx.result().statusCode, 400);
      assert.match(ctx.result().payload.error, /OCR text or imageBase64/i);
    } finally {
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  });

  it("fails closed when OPENAI_API_KEY is missing", async () => {
    const prev = process.env.OPENAI_API_KEY;
    const prevEnv = process.env.NODE_ENV;
    delete process.env.OPENAI_API_KEY;
    process.env.NODE_ENV = "production";
    try {
      const ctx = mockReqRes({ body: { text: "Calories 230 Protein 10g" } });
      await handler(ctx.req, ctx.res);
      assert.equal(ctx.result().statusCode, 500);
      assert.match(
        String(ctx.result().payload.error),
        /not configured|Missing OPENAI_API_KEY/i,
      );
    } finally {
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
      if (prevEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnv;
    }
  });
});
