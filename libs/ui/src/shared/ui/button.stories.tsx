import preview from "../../../storybook/preview";
import { Button } from "./button";

const meta = preview.meta({ component: Button });

export const Primary = meta.story({
  args: { children: "保存する", type: "button", variant: "primary" },
});

export const Secondary = meta.story({ args: { children: "キャンセル", type: "button" } });

export const Danger = meta.story({
  args: { children: "削除する", type: "button", variant: "danger" },
});

export const Small = meta.story({ args: { children: "編集", size: "small", type: "button" } });

export const Disabled = meta.story({
  args: { children: "送信中", disabled: true, type: "submit", variant: "primary" },
});

export const IconOnly = meta.story({
  args: { "aria-label": "閉じる", children: "×", size: "small", type: "button" },
});
