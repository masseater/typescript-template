import { formatWarekiMonth } from "@repo/ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { baselineProfileLayout } from "#shared/profile-layout/default.ts";
import { ProfileLayoutRenderer } from "#shared/profile-layout/renderer.tsx";

import type { Member } from "#pages/profile/model/member.ts";

const member = {
  id: "member-1",
  joined: "2026-04",
  name: "山田 花子",
  photos: { company: null, face: null },
  profile: "本屋めぐりをしています。",
  profileLayout: baselineProfileLayout,
  sheet: {},
  socialLinks: [],
} as const satisfies Member;

describe("profile layout", () => {
  it("renders the layout blocks with the biography and registration month", () => {
    expect.hasAssertions();
    const html = renderToStaticMarkup(
      createElement(ProfileLayoutRenderer, {
        layout: member.profileLayout,
        member,
        own: true,
        sheet: member.sheet,
      }),
    );
    expect(html).toContain("<h1");
    expect(html).toContain(member.name);
    expect(html).toContain(member.profile);
    expect(html).toContain(`${formatWarekiMonth(member.joined)}に登録`);
  });
});
