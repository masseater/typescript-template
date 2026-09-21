import preview from "../../../storybook/preview";
import { Avatar } from "./avatar";

const meta = preview.meta({ args: { name: "山田 太郎" }, component: Avatar });

export const Medium = meta.story();

export const Small = meta.story({ args: { size: "small" } });

export const Large = meta.story({ args: { size: "large" } });

export const Latin = meta.story({ args: { name: "taro yamada" } });

const photo = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#8ab"/><circle cx="40" cy="32" r="14" fill="#fff"/><ellipse cx="40" cy="70" rx="24" ry="16" fill="#fff"/></svg>',
)}`;

export const Photo = meta.story({ args: { size: "large", src: photo } });
