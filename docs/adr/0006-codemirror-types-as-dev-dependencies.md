# 0006: CodeMirror の型を devDependencies に固定バージョンで追加する

- 状態: 採用
- 日付: 2026-10-24

## 状況

ライブプレビューで、コードブロックやインラインコードの中を置換しないために、`@codemirror/language` の `syntaxTree` を使う。型定義がないと `tsc` が通らない。実行時は Obsidian が `@codemirror/*` を提供するため、バンドルに含める必要はない（`esbuild.config.mjs` の `external` に指定済み）。

## 決定

- `@codemirror/language` 6.13.1 を、`devDependencies` に固定バージョンで追加する。
- `@codemirror/state` 6.5.0 と `@codemirror/view` 6.38.6 も、`devDependencies` に明記する。すでに `obsidian` パッケージの `peerDependencies` により入っていたが、直接 import しているため、ESLint の `import/no-extraneous-dependencies` の警告が出ていた。バージョンは、Obsidian が指定する値に合わせる。

## 検討した代替案

- 依存を追加せず、バッククォートの数でコード内かを判定する。簡易だが、フェンス付きコードブロックの中を誤って置換する。
- `syntaxTree` を使わず、DOM のクラス名で判定する。デコレーションの計算時点では、DOM が存在しない。

## 結果

- コードの判定に、構文木を使える。
- 追加されるのは型の参照用で、`main.js` には入らない。`node_modules` には `@lezer/*` などの推移的な依存が増える。
- 型の定義と、実行時に Obsidian が提供する実体のバージョンがずれる可能性がある。`@codemirror/state` と `@codemirror/view` は、Obsidian の指定に合わせて固定することで抑える。
- コードの判定は、構文木のノード名に `code` を含むかによる。Obsidian 上で、フェンス付きコードブロックの中が置換されないことを確認済み。
