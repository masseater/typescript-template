import * as v from "valibot";
import { expect, test } from "vitest";
import { apiResponse, readJson, secureResponse } from "./http.ts";

test("reads a bounded same-origin JSON mutation", async () => {
  const body = { name: "利用者", profile: "自己紹介です。" };
  const request = new Request("http://localhost:3001/api/profile", {
    method: "PATCH",
    headers: { origin: "http://localhost:3001", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(await readJson(request, "http://localhost:3001")).toEqual(body);
});

test.for([
  { origin: "https://other.example.test", type: "application/json", body: "{}", statusCode: 403 },
  { origin: "http://localhost:3001", type: "text/plain", body: "{}", statusCode: 415 },
  { origin: "http://localhost:3001", type: "application/json", body: "{", statusCode: 400 },
  {
    origin: "http://localhost:3001",
    type: "application/json",
    body: "x".repeat(16385),
    statusCode: 413,
  },
])("rejects mutation with status $statusCode", async ({ origin, type, body, statusCode }) => {
  const request = new Request("http://localhost:3001/api/profile", {
    method: "PATCH",
    headers: { origin, "content-type": type },
    body,
  });
  await expect(readJson(request, "http://localhost:3001")).rejects.toMatchObject({ statusCode });
});

test("returns validation errors without echoing submitted values", async () => {
  const response = await apiResponse(async () => v.parse(v.number(), "private-profile-text"));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "入力内容を確認してください。" });
});

test("keeps status and body while preventing cached private responses", async () => {
  const response = secureResponse(Response.json({ ready: true }, { status: 201 }));
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ ready: true });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("x-frame-options")).toBe("DENY");
});
