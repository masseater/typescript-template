# 隠しても状態を残すなら Activity

大本: https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/rendering-activity.md

頻繁に出し入れする重い部分は、条件でアンマウントせず `<Activity mode={open ? "visible" : "hidden"}>` に置く。`hidden` は Effect を破棄し更新の優先度を下げるが、state と DOM は残す。

開閉の状態自体は Effect Atom に置く。`useState` は使わない。
