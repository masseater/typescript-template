# typescript-template

Cloudflare で動く TypeScript の Web アプリを、検査・CI・デプロイ・AI エージェントとの作業の決まりが
そろった状態から始めるための GitHub テンプレートである。
新しいリポジトリを作るたびに、lint や CI やデプロイの仕組みを組み直さずに済む。

## 公開先

- テンプレートのままのアプリ: <https://typescript-template-web-production-ntesuocc46gilfjl.masseater.workers.dev>

## 始めたときに入っているもの

- TanStack Start と Effect で書く Web アプリ。D1 のデータベースと better-auth のログインを使える
- 型検査・lint・テスト・依存の監査を 1 回で流す `vp run verify`
- main に push すると、verify が通ったあとに Cloudflare へデプロイする GitHub Actions
- Claude Code で作業するときのフックと作業の決まり

## 使い方

### 前提

- [Vite+](https://viteplus.dev/guide/) の `vp` コマンド
- `gh`、uv、Go、Python 3、jq。verify の一部がこれらで動く
- Workers Paid プランの Cloudflare アカウント
- OpenRouter の API キー。verify の lint の一部が使う

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

`vp env on` で、リポジトリが求める版の Node.js と pnpm を vp が用意する。
`.env` の `OPENROUTER_API_KEY` にキーを書く。
Cloudflare の認証情報は、最後のコマンドで作る Alchemy のプロファイルに入る。

```sh
vp run verify
cd apps/web && vp run dev
```

verify が通り、dev が表示した URL を開いてアプリが出れば準備はできている。

### 4. GitHub の設定をそろえる

Actions の secrets、Actions による PR 作成の許可、既定ブランチのルールセットは、テンプレートから引き継がれない。
[masseater/skills](https://github.com/masseater/skills) の `setup-template` スキルの手順で設定する。

設定が済めば、main への push のたびに本番へデプロイされる。
手元からデプロイするときは `apps/web` で `vp run deploy` を実行する。

## テンプレートの更新を取り込む

作ったリポジトリで Claude Code のセッションを始めると、テンプレートの新しいリリースがあれば知らせが出る。
取り込むと答えれば、前のリリースとの差分を当てて verify を通すところまで進む。
