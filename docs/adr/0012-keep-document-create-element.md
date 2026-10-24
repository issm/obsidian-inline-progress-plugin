# 0012: 要素の作成に `doc.createElement` を使い続ける

- 状態: 採用
- 日付: 2026-10-24

## 状況

`eslint-plugin-obsidianmd` 0.4.2 の `prefer-create-el` が、`doc.createElement('div')` を `doc.win.createDiv()` に、`doc.createDocumentFragment()` を `doc.win.createFragment()` に置き換えるよう警告する（5件。[issue #2](https://github.com/issm/obsidian-inline-progress-plugin/issues/2)）。

このプラグインは、要素を作る `Document`（`doc`）を呼び出し側から渡している（`el.ownerDocument` / `view.dom.ownerDocument`）。ポップアウトウィンドウでは、そのウィンドウの `Document` で作らないと、要素が正しく動かないことがあるため。

## 決定

- `render.ts` と `reading-view.ts` では、`doc.createElement` と `doc.createDocumentFragment` を使い続ける。
- この2ファイルに限って、`obsidianmd/prefer-create-el` を無効にする（`eslint.config.mts`）。

## 理由

- 提案の `doc.win.createDiv()` は、型チェックを通らない。`doc.win` は `Window` 型で、`obsidian` 1.14.4 の型定義には、`Window` に `createDiv` / `createSpan` / `createFragment` がない（`TS2339: Property 'createSpan' does not exist on type 'Window'`）。ルール側も `Window` にこれらがない場合は、自動修正を出さず、提案だけにしている。
- 型定義が提供するヘルパーは、グローバル関数（`createDiv()` など）と `Node` のメソッド（`parent.createDiv()`）。グローバル関数は、メインウィンドウの `document` で作る。ポップアウトウィンドウの要素を、渡された `doc` で作る今の方針と合わない。
- 型を `as` で書き換えて通す方法は、実行時にポップアウトウィンドウで `win.createDiv` が存在するかを、型で守れなくなる。

## 検討した代替案

- `doc.win.createDiv()` へ、型を上書きして置き換える。実行時の挙動を、型で保証できない。
- `parent.createDiv()` / `parent.createSpan()` で子要素を作る。ルート要素と断片は、結局 `doc` から作る必要があり、警告が残る。ルート以外だけを置き換えると、作り方が2通りに混ざる。
- ルールを全体で無効にする。他の箇所で、本来直すべき警告を見逃す。

## 結果

- 警告は出なくなる。ポップアウトウィンドウでの動作は、今までと変わらない。
- 型定義が `Window` に `createDiv` などを含むようになったら、見直す。そのときは、2ファイルの無効化を外し、`--fix` で置き換えられる。
