# Git の規約

`inline-progress` プラグインの開発リポジトリでの、git の扱い方。

## リポジトリの場所

- このリポジトリのルートは、プラグインのディレクトリ（Vault から見て `.obsidian/plugins/inline-progress/`）。
  - リモート: `origin`（`git@github.com:issm/obsidian-inline-progress-plugin.git`）
- Vault は、このリポジトリを開発用に含んでいるだけで、Vault 自体は git のリポジトリではない。Vault 直下で git のコマンドを実行すると `fatal: not a git repository` になる。
- git のコマンドは、このリポジトリのルートで実行する（`cwd` を指定する）。
- Vault 内のノートや画像（`dev/inline-progress/sample.md`、`dev/inline-progress/images/`、Vault 直下の実装方針のメモなど）は、リポジトリの管理外。コミットに含まれない。

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/) の形式で書く。

```
<type>: <subject>

<body>
```

- 言語は英語。
- 題名（1行目）は、小文字で始まる命令形にする。末尾にピリオドを付けない。72文字以内を目安にする。
- 本文には、何を変えたかではなく、なぜ変えたか・どう変えたかの要点を書く。題名で足りる小さな変更では省略してよい。
- スコープ（`feat(parser):` など）は、今は使わない。

### type の使い分け

| type | 使う場面 |
|---|---|
| `feat` | 利用者から見える機能の追加・変更 |
| `fix` | 不具合の修正 |
| `docs` | 文書だけの変更（README、`docs/`、ADR） |
| `refactor` | 挙動を変えないコードの整理 |
| `style` | 見た目だけの整形（空白、書式）。CSS の見た目の変更は `feat` か `fix` |
| `test` | テストの追加・修正 |
| `build` | ビルドや依存関係（`package.json`、`esbuild.config.mjs`） |
| `chore` | 上のどれにも当てはまらない雑務 |

互換性を壊す変更は、type の直後に `!` を付け（`feat!:`）、本文に `BREAKING CHANGE:` を書く。

### 例（このリポジトリの履歴より）

```
feat: render [progress:: ...] fields as inline progress bars
docs: add README, design notes and ADRs
feat: add tick marks between progress segments
docs: document tick marks and add ADR 0007
```

## コミットの作り方

- コミットは、ユーザーに頼まれたときだけ作る。
- 実装と文書は、別のコミットに分ける（例: `feat:` のあとに `docs:`）。
- ステージするファイルは、ファイル名で指定する。`git add .` や `git add -A` は使わない。
- 次のものはコミットしない。`.gitignore` で除外済み。
  - `main.js`（ビルドの成果物）
  - `node_modules/`
  - `data.json`（プラグインの設定）
- 鍵や認証情報を含みそうなファイル（`.env` など）は、コミット前にユーザーに知らせる。
- フック（`--no-verify`）は、ユーザーが頼まない限り飛ばさない。

## ブランチとプッシュ

- プッシュは、ユーザーに頼まれたときだけ行う。
- プッシュ先は、新しいブランチにする。`master` や `main` に直接プッシュしない（ユーザーが明示した場合を除く）。
- 新しいブランチは `git push -u origin <branch>` で、追跡を設定してプッシュする。
- 主とするブランチは `main`（リモートの既定ブランチも `main`）。以前の `master` は使わない。
- ブランチの構成が想定と違っていたら（ブランチ名の変更、追跡先の食い違いなど）、プッシュ前にユーザーに確認する。
- `git config` やブランチの追跡設定（`git branch -u`）は、ユーザーが頼まない限り変更しない。

## 履歴の書き換え

ユーザーに頼まれたときだけ行う。対象は、まだプッシュしていないコミットに限る。プッシュ済みのコミットは書き換えない。

- `git rebase -i` のような対話的な操作は使えない。メッセージだけを直すときは、`git commit-tree` でコミットを作り直し、`git update-ref` でブランチを動かす。
- **作者・コミッターの名前、メールアドレス、日時を保つ。** 書き換えると日時が現在に変わる。元のコミットから取り直して、`git commit-tree` に環境変数で渡す。
  - 過去に、環境変数が渡らず、4つのコミットが同じ時刻になった。メッセージとツリーだけを確認して、日時を確認しなかった。
- 書き換えたあとは、次を確認してから報告する。
  - 書き換え前後で、ツリーが同一であること（`git diff <旧> <新>` が空）
  - 新旧のコミットごとに、作者・コミッター・日時が一致すること
  - 作業ツリーが変わっていないこと（`git status`）
- ブランチを動かす前に、旧い先頭のコミットのハッシュを控える。`git update-ref` の第3引数に旧い値を渡して、想定外のずれがあれば失敗するようにする。

## シェルでの注意

このワークスペースのシェルは fish。bash の書き方がそのまま動かないことがある。

- 環境変数の前置（`VAR=value git ...`）は使えない。`env VAR=value git ...` と書く。
- 変数の代入は `set VAR value`。`VAR=value` とは書けない。
- ヒアドキュメント（`<<EOF`）は使えない。複数行のスクリプトは、ファイルに書いてから `bash <file>` で実行する。
- macOS の標準の bash は古く（3系）、`mapfile` が使えない。配列には `arr=($(...))` を使う。
- 実行後は、一時スクリプトを削除する。
