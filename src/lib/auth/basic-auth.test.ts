import { describe, expect, it } from "vitest";
import {
  credentialsMatch,
  isBasicAuthConfigured,
  parseBasicAuthorizationHeader,
} from "./basic-auth";

describe("basic auth helpers", () => {
  it("detects configured credentials", () => {
    expect(isBasicAuthConfigured({})).toBe(false);
    expect(
      isBasicAuthConfigured({
        AUTH_USER: "admin",
        AUTH_PASSWORD: "secret",
      }),
    ).toBe(true);
  });

  it("parses Basic Authorization headers", () => {
    const token = btoa("admin:s3cret");
    expect(parseBasicAuthorizationHeader(`Basic ${token}`)).toEqual({
      user: "admin",
      password: "s3cret",
    });
    expect(parseBasicAuthorizationHeader(null)).toBeNull();
    expect(parseBasicAuthorizationHeader("Bearer x")).toBeNull();
  });

  it("matches credentials against env", () => {
    const env = {
      AUTH_USER: "admin",
      AUTH_PASSWORD: "s3cret",
    };
    expect(
      credentialsMatch({ user: "admin", password: "s3cret" }, env),
    ).toBe(true);
    expect(
      credentialsMatch({ user: "admin", password: "nope" }, env),
    ).toBe(false);
  });
});
