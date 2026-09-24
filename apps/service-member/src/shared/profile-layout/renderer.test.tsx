import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ProfileLayoutRenderer } from "./renderer.tsx";

describe("profile layout renderer", () => {
  it("renders the chosen blocks in order", () => {
    const markup = renderToStaticMarkup(
      <ProfileLayoutRenderer
        layout={{
          blocks: [
            { kind: "identity" },
            { kind: "sheet-occupation" },
            { kind: "sheet-message" },
            { kind: "joined" },
          ],
        }}
        member={{
          id: "member",
          joined: "2026-03",
          name: "山田 太郎",
          photos: { company: null, face: null },
          profile: "",
          socialLinks: [],
        }}
        own={false}
        sheet={{ message: "よろしく", occupation: "エンジニア" }}
      />,
    );
    const occupation = markup.indexOf("職種");
    const message = markup.indexOf("ひとこと");
    const joined = markup.indexOf("に登録");
    expect(occupation).toBeLessThan(message);
    expect(message).toBeLessThan(joined);
  });

  it("skips empty sheet fields and the actions block when there are no actions", () => {
    expect.hasAssertions();
    const markup = renderToStaticMarkup(
      <ProfileLayoutRenderer
        layout={{
          blocks: [
            { kind: "sheet-nickname" },
            { kind: "sheet-interests" },
            { kind: "sheet-area" },
            { kind: "biography" },
            { kind: "social-links" },
            { kind: "actions" },
          ],
        }}
        member={{
          id: "member",
          joined: "2026-03",
          name: "山田 太郎",
          photos: { company: null, face: null },
          profile: "",
          socialLinks: [],
        }}
        own={false}
        sheet={{ area: "東京" }}
      />,
    );
    expect(markup).toContain('aria-label="活動エリア"');
    expect(markup).toContain("東京");
    expect(markup).not.toContain('aria-label="呼び名"');
    expect(markup).toContain("自己紹介はまだありません");
    expect(markup).not.toContain("flex flex-col gap-3");
  });

  it("puts the given actions in their block", () => {
    expect.hasAssertions();
    const markup = renderToStaticMarkup(
      <ProfileLayoutRenderer
        actions={<button type="button">フォロー</button>}
        layout={{ blocks: [{ kind: "biography" }, { kind: "actions" }] }}
        member={{
          id: "member",
          joined: "2026-03",
          name: "山田 太郎",
          photos: { company: null, face: null },
          profile: "本屋めぐりをしています。",
          socialLinks: [],
        }}
        own
        sheet={{}}
      />,
    );
    expect(markup).toContain("本屋めぐりをしています。");
    expect(markup).toContain(
      '<div class="flex flex-col gap-3"><button type="button">フォロー</button></div>',
    );
  });
});
