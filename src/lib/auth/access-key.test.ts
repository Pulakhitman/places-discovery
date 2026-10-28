import { describe, expect, it } from "vitest";
import {
  accessKeyMatches,
  cookieMatchesAccessKey,
  hashAccessKey,
  isAccessKeyConfigured,
  timingSafeEqual,
} from "./access-key";

describe("isAccessKeyConfigured", () => {
  it("is false when ACCESS_KEY is missing or empty", () => {
    expect(isAccessKeyConfigured({})).toBe(false);
    expect(isAccessKeyConfigured({ ACCESS_KEY: "" })).toBe(false);
  });

  it("is true when ACCESS_KEY has a value", () => {
    expect(isAccessKeyConfigured({ ACCESS_KEY: "secret" })).toBe(true);
  });
});

describe("timingSafeEqual", () => {
  it("compares equal and unequal strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
  });
});

describe("hashAccessKey / cookieMatchesAccessKey", () => {
  it("hashes stably and verifies the cookie digest", async () => {
    const env = { ACCESS_KEY: "test-key-123" };
    const digest = await hashAccessKey(env.ACCESS_KEY);
    expect(digest).toHaveLength(64);
    expect(await cookieMatchesAccessKey(digest, env)).toBe(true);
    expect(await cookieMatchesAccessKey("deadbeef", env)).toBe(false);
    expect(await cookieMatchesAccessKey(digest, {})).toBe(false);
  });
});

describe("accessKeyMatches", () => {
  it("accepts the exact key and rejects others", async () => {
    const env = { ACCESS_KEY: "shared-key" };
    expect(await accessKeyMatches("shared-key", env)).toBe(true);
    expect(await accessKeyMatches("wrong", env)).toBe(false);
    expect(await accessKeyMatches("", env)).toBe(false);
  });
});
