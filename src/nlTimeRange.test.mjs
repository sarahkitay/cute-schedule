import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractNlTimeRange } from "./nlTimeRange.js";

describe("extractNlTimeRange", () => {
  it("parses 10am to 5pm", () => {
    const r = extractNlTimeRange("numen group 10am to 5pm");
    assert.deepEqual(r, { start: "10:00", end: "17:00", working: "numen group" });
  });

  it("parses dinner 5-7pm", () => {
    const r = extractNlTimeRange("dinner 5-7pm");
    assert.deepEqual(r, { start: "17:00", end: "19:00", working: "dinner" });
  });

  it("parses 10am-5pm with hyphen", () => {
    const r = extractNlTimeRange("meeting 10am-5pm");
    assert.equal(r.start, "10:00");
    assert.equal(r.end, "17:00");
    assert.equal(r.working, "meeting");
  });

  it("parses from … until …", () => {
    const r = extractNlTimeRange("focus block from 9am until 12:30pm");
    assert.equal(r.start, "09:00");
    assert.equal(r.end, "12:30");
    assert.equal(r.working, "focus block");
  });

  it("infers pm end after am start when end has no meridiem", () => {
    const r = extractNlTimeRange("shift 10am to 5");
    assert.equal(r.start, "10:00");
    assert.equal(r.end, "17:00");
  });

  it("parses 24h range", () => {
    const r = extractNlTimeRange("lab 13:00-17:00");
    assert.equal(r.start, "13:00");
    assert.equal(r.end, "17:00");
    assert.equal(r.working, "lab");
  });

  it("rejects end before start", () => {
    assert.equal(extractNlTimeRange("oops 5pm to 3pm"), null);
  });

  it("rejects bare 5-7 without meridiem", () => {
    assert.equal(extractNlTimeRange("dinner 5-7"), null);
  });

  it("strips leftover leading from", () => {
    const r = extractNlTimeRange("from dinner 5-7pm");
    assert.equal(r.start, "17:00");
    assert.equal(r.end, "19:00");
    assert.equal(r.working, "dinner");
  });
});
