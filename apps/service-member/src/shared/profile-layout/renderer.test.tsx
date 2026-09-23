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
});
