import { describe, expect, it } from "vite-plus/test";
import { memberPageSize } from "@template/runtime/contracts";
import { nextMemberPage } from "./member-pages.ts";

const firstPage = 1;
const secondPage = 2;
const thirdPage = 3;

describe("infinite scroll of the member list", () => {
  it("asks for the next page while loaded members fall short of the total", () => {
    expect.hasAssertions();
    expect(nextMemberPage(firstPage, memberPageSize + 1)).toBe(secondPage);
    expect(nextMemberPage(secondPage, memberPageSize * secondPage + 1)).toBe(thirdPage);
  });

  it("stops at the page that reaches the total", () => {
    expect.hasAssertions();
    expect(nextMemberPage(firstPage, memberPageSize)).toBeUndefined();
    expect(nextMemberPage(secondPage, memberPageSize * secondPage)).toBeUndefined();
  });

  it("stops when no member matches", () => {
    expect.hasAssertions();
    expect(nextMemberPage(firstPage, 0)).toBeUndefined();
  });
});
