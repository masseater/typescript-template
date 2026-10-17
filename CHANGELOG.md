# Changelog

## [0.0.11](https://github.com/masseater/typescript-template/compare/v0.0.10...v0.0.11) (2026-10-13)


### Features

* add integrate, skill-authoring and how-to-use-react from masseater/skills ([#200](https://github.com/masseater/typescript-template/issues/200)) ([8f653a3](https://github.com/masseater/typescript-template/commit/8f653a360285a931a71167ff9c079f04436395a0))
* **ci:** add opt-in OWASP ZAP baseline scan workflow ([#191](https://github.com/masseater/typescript-template/issues/191)) ([27ddb2a](https://github.com/masseater/typescript-template/commit/27ddb2aca6fb8cd366eebae23517a35496fe346d))
* **ci:** fail the ZAP job on any alert ([#193](https://github.com/masseater/typescript-template/issues/193)) ([977327e](https://github.com/masseater/typescript-template/commit/977327eba77a9e30e32fbdb22e62b48878f1c065))
* keep archived Workers logs for 30 days instead of 90 ([#199](https://github.com/masseater/typescript-template/issues/199)) ([c349d4e](https://github.com/masseater/typescript-template/commit/c349d4e2928f527aa73444f2bebb952ea8f1a9af))
* **skills:** add every skill from philtzjp/skills to skills-lock.json ([#187](https://github.com/masseater/typescript-template/issues/187)) ([5425a86](https://github.com/masseater/typescript-template/commit/5425a86de7b73f5d5df63354b7bb1f0360bce548))
* **skills:** install measure-dont-guess and setup-github from masseater/skills ([#189](https://github.com/masseater/typescript-template/issues/189)) ([d392929](https://github.com/masseater/typescript-template/commit/d392929e8c737d7355696eb7b378cd2e5afa95b2))
* **verify:** fail verify on known dependency vulnerabilities ([#192](https://github.com/masseater/typescript-template/issues/192)) ([757c044](https://github.com/masseater/typescript-template/commit/757c044faeb249044f7397bfb71c73cde7a037e9))
* WAF scanner block rules from hono-honeypot pattern list (scanner-probes.ts) ([#202](https://github.com/masseater/typescript-template/issues/202)) ([2984163](https://github.com/masseater/typescript-template/commit/2984163ee5cac968df04367a9068d2b5f3987592))
* **web:** archive Workers logs to R2 for 90 days via Workers Logpush ([#196](https://github.com/masseater/typescript-template/issues/196)) ([bc66237](https://github.com/masseater/typescript-template/commit/bc66237429aa705c8be7a867eece249ea0c5f3f3))
* **web:** edge guard blocks scanner probes and records a honeypot ([#194](https://github.com/masseater/typescript-template/issues/194)) ([6abd674](https://github.com/masseater/typescript-template/commit/6abd67419577bcf578997bd8d515b7a932f1581e))
* **web:** keep only failed invocations and a 1% sample in the 90-day log archive ([#197](https://github.com/masseater/typescript-template/issues/197)) ([bbc1a65](https://github.com/masseater/typescript-template/commit/bbc1a65c3ff8ddab33c34eb2eb94c4584e64f657))
* **web:** let requireAppPrefix accept ENV_PREFIX for Fly.Secret ([#190](https://github.com/masseater/typescript-template/issues/190)) ([8150612](https://github.com/masseater/typescript-template/commit/81506121c23291978c96c9c0f6b95bbb2da3460c))
* **web:** let requireAppPrefix accept LIST_PREFIX for Cloudflare Rules.List ([#182](https://github.com/masseater/typescript-template/issues/182)) ([5765dbd](https://github.com/masseater/typescript-template/commit/5765dbdf30e2de95d3cdd6029927d1d31d30ddde))
* **web:** let requireAppPrefix accept stack names starting with APP_NAME- ([#183](https://github.com/masseater/typescript-template/issues/183)) ([3e060e3](https://github.com/masseater/typescript-template/commit/3e060e348d030ef38ca463c32c9a89197a9722fe))
* **web:** sitemap・robots.txt・noindex の切り替え（SEARCH_INDEX_ORIGIN、検索クロール、SEO） ([6f028ac](https://github.com/masseater/typescript-template/commit/6f028ac2dcd74d3a99bd7103f2c31ca46433281e))
* **web:** sitemap, robots.txt and noindex switch for search crawlers ([ef2bb9b](https://github.com/masseater/typescript-template/commit/ef2bb9b19d4188ccecc450291f4a6362a489cb3d))

## [0.0.10](https://github.com/masseater/typescript-template/compare/v0.0.9...v0.0.10) (2026-10-12)


### Features

* **ci:** GitHub Actions のジョブ・ステップ所要時間を自前 Worker (OIDC 認証) で受けて Workers Logs に記録する ([b87f05f](https://github.com/masseater/typescript-template/commit/b87f05f11e572174c0ecdfc03e47d7110c71add0))
* **ci:** record GitHub Actions job and step timings in Workers Logs ([9dcbc6a](https://github.com/masseater/typescript-template/commit/9dcbc6af4a3c5689e3f43e1ca7dd751118925eb7))

## [0.0.9](https://github.com/masseater/typescript-template/compare/v0.0.8...v0.0.9) (2026-10-12)


### Features

* jev-lint を oxlint-plugin-decision に置き換える ([#156](https://github.com/masseater/typescript-template/issues/156)) ([1eacd14](https://github.com/masseater/typescript-template/commit/1eacd14b7eba58a4e6661ce9b6e87a77fa0f3d29))
* pass the caller's environment to the decision lint for OpenRouter attribution ([#175](https://github.com/masseater/typescript-template/issues/175)) ([f9c03db](https://github.com/masseater/typescript-template/commit/f9c03dbfeee51422488a5c3d3dd2c7d0beddd10e))

## [0.0.8](https://github.com/masseater/typescript-template/compare/v0.0.7...v0.0.8) (2026-10-12)


### Features

* block pnpm calls from Claude Code with a PreToolUse hook ([#134](https://github.com/masseater/typescript-template/issues/134)) ([8babf76](https://github.com/masseater/typescript-template/commit/8babf76c1b7f3f62ad108cd407a1225bc39ee01f))
* define the app name once and require it as the alchemy prefix ([705a471](https://github.com/masseater/typescript-template/commit/705a47148cf50c6053cd26ea78a41d59f2c89a6a))
* define the app name once and require it as the alchemy prefix ([ed68b00](https://github.com/masseater/typescript-template/commit/ed68b0006548b001dbfb723d7f4f88b58e334e2d))
* **skills:** add stop-describing-ui from artouc/stop-describe-ui ([#142](https://github.com/masseater/typescript-template/issues/142)) ([cff2b52](https://github.com/masseater/typescript-template/commit/cff2b529887cbe4f8d2628a063b95e9933935143))

## [0.0.7](https://github.com/masseater/typescript-template/compare/v0.0.6...v0.0.7) (2026-10-11)


### Features

* **infra:** run infra/github in any repository made from the template ([#130](https://github.com/masseater/typescript-template/issues/130)) ([a211877](https://github.com/masseater/typescript-template/commit/a211877698c6630e39ab3c16fe62232b8661b18c))

## [0.0.6](https://github.com/masseater/typescript-template/compare/v0.0.5...v0.0.6) (2026-10-11)


### Features

* manage repository settings and rulesets with Alchemy in infra/github ([#117](https://github.com/masseater/typescript-template/issues/117)) ([652e310](https://github.com/masseater/typescript-template/commit/652e31089174dc86df3ee3cdb799340d3551a020))

## [0.0.5](https://github.com/masseater/typescript-template/compare/v0.0.4...v0.0.5) (2026-10-11)


### Features

* judge jev-lint rules with the free span-01-lite where it holds up ([#115](https://github.com/masseater/typescript-template/issues/115)) ([4c76164](https://github.com/masseater/typescript-template/commit/4c7616423ca987aec486369aee1498155cc868fd))

## [0.0.4](https://github.com/masseater/typescript-template/compare/v0.0.3...v0.0.4) (2026-10-10)


### Features

* verify でテストを実行し、__mocks__ のエクスポートを fallow から外す ([b82e768](https://github.com/masseater/typescript-template/commit/b82e768e18f7147f2bd9f8747550ad84980a2056))
* verify でテストを実行し、__mocks__ のエクスポートを fallow から外す ([ccf17b2](https://github.com/masseater/typescript-template/commit/ccf17b2a9b3d1784e212ff0c29359786f71691ad))
* **web:** add a Cloudflare-aware Effect logger ([#107](https://github.com/masseater/typescript-template/issues/107)) ([be7a28d](https://github.com/masseater/typescript-template/commit/be7a28dc32a10d8db6c214f8ac005d3deffe3d0a))

## [0.0.3](https://github.com/masseater/typescript-template/compare/v0.0.2...v0.0.3) (2026-10-10)


### Features

* authenticate the Cloudflare MCP server through the Alchemy profile ([#92](https://github.com/masseater/typescript-template/issues/92)) ([9998036](https://github.com/masseater/typescript-template/commit/999803647bcec89f5653fb7c4da700bc9fc6dced))
* **web:** measure MELT on Cloudflare Workers Observability only ([#96](https://github.com/masseater/typescript-template/issues/96)) ([dcfa190](https://github.com/masseater/typescript-template/commit/dcfa19080506d2bb9fbcb5151165a4a56a40f56d))

## [0.0.2](https://github.com/masseater/typescript-template/compare/v0.0.1...v0.0.2) (2026-10-10)


### Features

* connect the Cloudflare API MCP server ([#89](https://github.com/masseater/typescript-template/issues/89)) ([10ae6e1](https://github.com/masseater/typescript-template/commit/10ae6e185a149cc05935531ac011740b763172bc))
* let the AI read OpenTelemetry MELT data through mcp-grafana ([#84](https://github.com/masseater/typescript-template/issues/84)) ([9f45666](https://github.com/masseater/typescript-template/commit/9f45666e2f3f90f9070936ff78084f307a15c334))

## 0.0.1 (2026-10-04)


### Features

* Conventional Commits でないコミットを commitlint で弾く ([c00b702](https://github.com/masseater/typescript-template/commit/c00b70288894e9184d1c92ab2341145e403b5113))
* reject commits that do not follow Conventional Commits ([651dbfe](https://github.com/masseater/typescript-template/commit/651dbfeb7ca215c5b17e96aafef0cbeb36c4e5dd))
* reject direct pnpm invocations in favor of vp ([4a24b29](https://github.com/masseater/typescript-template/commit/4a24b298102bf8deeb4cf93a7149eb29da666dd0))
* reject direct pnpm invocations in favor of vp ([d71c332](https://github.com/masseater/typescript-template/commit/d71c3326013949b2df0e457fbd5db57183ac1949))
* release the template with release-please ([81abe8b](https://github.com/masseater/typescript-template/commit/81abe8b41139c7a6fb129ae77869e07824795935))
* release-please でリリースし、新しいセッションでテンプレート更新を知らせる ([3e1d9d4](https://github.com/masseater/typescript-template/commit/3e1d9d46e541abec861d8ea42e01dc6db1b9d471))
* tell new sessions about newer template releases ([5d56490](https://github.com/masseater/typescript-template/commit/5d56490fb4b7c728952b7380751c858a7e2ecba8))
