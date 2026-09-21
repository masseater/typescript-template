# 安い条件を非同期より先に見る

大本: https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/async-cheap-condition-before-await.md

`flag && localCondition` のように、ネットワークや DB の結果と、既に手元にある条件の両方が要るときは、手元の条件を先に見る。

手元の条件が偽なら flag も I/O も始めない。手元の条件が flag の結果に依存するとき、条件の方が重いとき、副作用の順番が仕様のときは、元の順番を保つ。
