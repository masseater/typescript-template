import { Button } from "./button";
import preview from "../../../.storybook/preview";

const meta = preview.meta({ component: Button });

const Primary = meta.story({ args: { children: "保存する", type: "button", variant: "primary" } });

const Secondary = meta.story({ args: { children: "キャンセル", type: "button" } });

const Danger = meta.story({ args: { children: "削除する", type: "button", variant: "danger" } });

const Small = meta.story({ args: { children: "編集", size: "small", type: "button" } });

const Disabled = meta.story({
  args: { children: "送信中", disabled: true, type: "submit", variant: "primary" },
});

const IconOnly = meta.story({
  args: { "aria-label": "閉じる", children: "×", size: "small", type: "button" },
});

export { Danger, Disabled, IconOnly, Primary, Secondary, Small };
