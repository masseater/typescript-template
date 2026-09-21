import { expect } from "storybook/test";

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

export const Small = meta.story({
  args: { children: "編集", size: "small", type: "button" },
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "編集" });
    const bounds = button.getBoundingClientRect();
    await expect(bounds.width).toBeGreaterThanOrEqual(24);
    await expect(bounds.height).toBeGreaterThanOrEqual(24);
    const rootPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const fontPx = Number.parseFloat(getComputedStyle(button).fontSize);
    await expect(fontPx).toBeLessThan(rootPx);
  },
});

export const Disabled = meta.story({
  args: { children: "送信中", disabled: true, type: "submit", variant: "primary" },
});

export const IconOnly = meta.story({
  args: { "aria-label": "閉じる", children: "×", size: "small", type: "button" },
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "閉じる" });
    const bounds = button.getBoundingClientRect();
    await expect(bounds.width).toBeGreaterThanOrEqual(24);
    await expect(bounds.height).toBeGreaterThanOrEqual(24);
    const rootPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const fontPx = Number.parseFloat(getComputedStyle(button).fontSize);
    await expect(fontPx).toBeLessThan(rootPx);
  },
});
