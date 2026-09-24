import { describe, expect, it } from "vite-plus/test";

import { reported } from "./lint-harness.ts";

const probeFile = "apps/service-admin/src/widgets/admin-frame/ui/probe.tsx";

const handRolledSidebars = [
  ["nav-in-aside", "export const Rail = () => <aside><nav><a href='/'>概要</a></nav></aside>;"],
  [
    "nested-nav",
    "export const Rail = () => <aside><div><nav aria-label='メニュー' /></div></aside>;",
  ],
  ["conditional-nav", "export const Rail = ({ open }) => <aside>{open ? <nav /> : null}</aside>;"],
  ["logical-nav", "export const Rail = ({ open }) => <aside>{open && <nav />}</aside>;"],
  [
    "shadcn-sidebar",
    'import { Sidebar } from "@/components/ui/sidebar"; export const Rail = Sidebar;',
  ],
  ["sidebar-file", 'import { Sidebar } from "./sidebar.tsx"; export const Rail = Sidebar;'],
  ["sidebar-relay", 'export { SidebarProvider } from "#shared/ui/sidebar";'],
  ["sidebar-star", 'export * from "../ui/sidebar";'],
] as const;

const allowedMarkup = [
  [
    "summary-aside",
    "export const Summary = () => <aside aria-label='利用者の要約'><p>本文</p></aside>;",
  ],
  [
    "pagination-nav",
    "export const Pages = () => <nav aria-label='ページ送り'><a href='/' /></nav>;",
  ],
  ["app-frame", 'import { AppFrame } from "@repo/ui"; export const Frame = AppFrame;'],
  ["sidebar-named-module", 'import { toggle } from "./sidebar-state.ts"; export const t = toggle;'],
] as const;

describe("app-frame-sidebar", () => {
  it.for(handRolledSidebars)("rejects %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("app-frame-sidebar", { code, filename: probeFile })).toBe(true);
  });

  it.for(allowedMarkup)("allows %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("app-frame-sidebar", { code, filename: probeFile })).toBe(false);
  });

  it("allows the shared AppFrame sidebar", () => {
    expect.hasAssertions();
    expect(
      reported("app-frame-sidebar", {
        code: "export const Frame = ({ sections }) => <aside><FrameNavigation sections={sections} /></aside>;",
        filename: "libs/ui/src/features/ui/app-frame.tsx",
      }),
    ).toBe(false);
  });
});
