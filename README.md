# typescript-template

Cloudflare で動く TypeScript の Web アプリを、検査・CI・デプロイ・AI エージェントとの作業の決まりが
そろった状態から始めるための GitHub テンプレートである。
新しいリポジトリを作るたびに、lint や CI やデプロイの仕組みを組み直さずに済む。

## 公開先

- テンプレートのままのアプリ: <https://typescript-template-web-production-ntesuocc46gilfjl.masseater.workers.dev>
- 静的な LP の見本: <https://typescript-template-landingpagjng25skxokz4cknxsbi3m7nu.masseater.workers.dev>

## 始めたときに入っているもの

- TanStack Start と Effect で書く Web アプリ。D1 のデータベースと better-auth のログインを使える
- 型検査・lint・テスト・依存の監査を 1 回で流す `vp run verify`
- main への push のたびに、verify を通してから Cloudflare へデプロイする GitHub Actions
- Claude Code で作業するときのフックと作業の決まり

`apps/lp` は、誰にでも見せる静的なページの見本である。

## 使い方

### 前提

Vite+ の [`vp`](https://viteplus.dev/guide/) コマンド、Workers Paid プランの Cloudflare アカウント、
OpenRouter の API キーが要る。
verify の一部は `gh`、Python 3、jq で動く。
lint の一部は OpenRouter のキーを使う。

### 1. テンプレートからリポジトリを作る

```sh
gh repo create <owner>/<name> --template masseater/typescript-template \
  --private --clone
cd <name>
```

### 2. アプリ名を変える

`apps/web/app-name.ts` の `APP_NAME` を、リポジトリの名前に変える。
同じ Cloudflare アカウントにある別のリポジトリと名前が重なると、互いのリソースを置き換え合う。

### 3. 手元で動かす

```sh
vp env on
vp install
cp .env.example .env
vp exec --filter web alchemy profile edit --add Cloudflare
```

`.env` の `OPENROUTER_API_KEY` に OpenRouter のキーを書く。

```sh
vp run verify
cd apps/web && vp run dev
```

### 4. GitHub の設定をそろえる

Actions の secrets、Actions による PR 作成の許可、既定ブランチのルールセットは、テンプレートから引き継がれない。
[masseater/skills](https://github.com/masseater/skills) の `project-checklist` スキルの
setup の手順で設定する。

設定が済むと、main への push のたびに本番へデプロイされる。
手元からデプロイするときは、`apps/web` で次を実行する。

```sh
vp run deploy
```

## テンプレートの更新を取り込む

作ったリポジトリで Claude Code のセッションを始めると、テンプレートに新しいリリースがあるときに知らせが出る。
取り込むよう答えれば、Claude Code が前のリリースとの差分を当てて verify を通す。
