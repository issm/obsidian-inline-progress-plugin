# 設計

Inline Progress の構成と実装の要点。記法そのものは [README](../README.md) を、設計上の判断の理由は [docs/adr/](adr/) を参照。

## 構成

`main.ts` はライフサイクルだけにして、機能は `src/progress/` に分けている。

```
src/
  main.ts            # onload で2つの表示経路を登録するだけ
  progress/
    parser.ts        # 文字列 → ProgressData の純粋関数（Obsidian API 非依存）
    render.ts        # ProgressData → DOM 要素
    reading-view.ts  # MarkdownPostProcessor（閲覧モード）
    live-preview.ts  # CodeMirror 6 拡張（ライブプレビュー）
styles.css           # 見た目
```

`parser.ts` と `render.ts` を2つの表示経路で共有する。見た目と判定が、モードによって食い違わないようにするため。

## データモデル

`parser.ts` が返す `ProgressData`:

| フィールド | 内容 |
|---|---|
| `total` | 区画の総数（範囲指定のときは、範囲の区画数） |
| `ranges` | 塗られる範囲（1始まり、両端を含む）。昇順で、隣接する位置は1つにまとめる |
| `filledCount` | 塗られる区画の数 |
| `showLabel` | ラベルを表示するか |
| `source` | 値の部分の元の表記（`aria-label` に使う） |

個数指定（`10/12`）は `ranges` が1つ（`[{start: 1, end: 10}]`）、位置指定は位置ごとの範囲になる。`render.ts` は両者を区別せず、`ranges` だけを見て描画する。

### 解析の流れ

1. 正規表現 `\[progress::([^\]\n]*)\]` でフィールドを探す。1行内で完結するものだけが対象。
2. 中身を `;` で分け、先頭を値、残りをオプションとして解析する。
3. 値は `^([\d,]+)\/(\d+)(?:-(\d+))?$` に一致しなければ不正。カンマを含めば位置指定、含まなければ個数指定。
   - `/` のうしろが `N` なら範囲は `1-N`、`A-B` なら範囲は `A`〜`B`（両端を含む）。開始が終了を超えるものは不正。
   - 範囲の区画数 `B - A + 1` が `total`（ラベルの分母）になる。
   - 位置指定の値は、範囲内の値そのもの。範囲の外にあれば不正。描画に渡す `ranges` には、`A` を引いて 1 始まりに換算した番号を入れる。個数指定は、範囲の先頭から数える。
4. 不正な値、未知のオプションは `null` を返す。呼び出し側は置換せず、元のテキストを残す。

`findProgressFields(text)` は、解析できたフィールドだけを、テキスト内の位置（`from` / `to`）と一緒に返す。

## 表示の2経路

| モード | 仕組み | 実装 |
|---|---|---|
| 閲覧モード | Markdown が HTML に変換されて表示される | `registerMarkdownPostProcessor` で描画済み HTML を書き換える |
| ライブプレビュー | エディタ本体（CodeMirror 6）が表示を担う | `ViewPlugin` と `Decoration.replace` でウィジェットに置換し、`registerEditorExtension` で登録 |
| ソースモード | 生のテキストを見るモード | 置換しない（`editorLivePreviewField` で判定） |

### 閲覧モード（`reading-view.ts`）

1. 描画済み要素内のテキストノードを `TreeWalker` で走査する。走査中に DOM を書き換えると壊れるので、先に対象のノードを集めてから置換する。
2. `<code>` と `<pre>` の中は除外する。
3. 一致した部分だけを要素に差し替え、前後のテキストは残す。

### ライブプレビュー（`live-preview.ts`）

1. 表示範囲（`view.visibleRanges`）だけを走査して、性能を保つ。フィールドが分断されないよう、範囲は行の端まで広げる。
2. 一致箇所を `WidgetType` のサブクラスに置換する。`RangeSetBuilder` は昇順でしか追加できないので、追加済みの末尾を覚えておき、重なる分はスキップする。
3. カーソルや選択範囲が一致箇所に触れているときは置換しない（編集できるようにするため）。
4. ウィジェットの `ignoreEvent()` は `false` にして、クリックをエディタに処理させる。
5. コードの中は、`syntaxTree` で自分から親へたどり、ノード名に `code` を含むか調べて除外する。
6. 再計算するのは、文書の変更、表示範囲の変更、選択範囲の変更、モードの切り替え、構文木の更新のとき。
7. `eq()` は元のテキストだけで比較する。同じ表記なら DOM を作り直さない。

## DOM と CSS

```html
<span class="inline-progress [is-complete]">
  <div class="inline-progress-track" role="progressbar"
       aria-valuemin="0" aria-valuemax="12" aria-valuenow="3" aria-label="1,3,5/12">
    <div class="inline-progress-fill" style="--inline-progress-start: 0; --inline-progress-length: 0.0833"></div>
    <!-- 塗り範囲ごとに1つ -->
  </div>
  <span class="inline-progress-label">3/12</span>  <!-- nolabel なら無い -->
</span>
```

- 外側は `span`（`inline-flex`）で、文中に置くための入れ物。トラックとラベルを横に並べる。
- トラックは固定幅の `div`。塗り領域はその内側に `position: absolute` で置く。
- 塗り領域の位置と幅は、トラックに対する割合（0〜1）を CSS 変数で渡し、`calc(var(--inline-progress-start) * 100%)` で変換する。区画ごとに要素を作らないので、総数が大きくても要素数は増えない。
- 位置 `i`（1始まり）の範囲は `start = (i-1)/total`、`length = 範囲の長さ/total`。
- 全区画が塗られているとき（`filledCount === total`）は、外側に `is-complete` クラスを付け、塗りを `--text-success` にする。
- 区画の境目の目盛り線は、総数が 2 以上のとき、外側に `has-ticks` クラスを付けて描く。判断の理由は [ADR 0007](adr/0007-ticks-drawn-with-css-gradient.md)。
  - トラックに `--inline-progress-total`（総数）を渡し、トラックの `::after` に `repeating-linear-gradient` で線を引く。塗り領域の上に重なる。
  - 1区画の幅は `(100% + 線の太さ) / 総数`。`::after` の右側を線の太さだけ詰め、最後の区画の線がはみ出して描かれないようにしている（右端に線を引かない）。
  - 表示するかどうかは、1区画の幅（`100cqw / 総数`）で決める。4px 以上で表示、未満で非表示。計算の誤差で 4px ちょうどが消えないよう、0.01px 手前から表示に移る。`100cqw` はトラックの `container-type: inline-size` による。長さ ÷ 長さが使える環境でだけ有効（`@supports`）。
  - 使えない環境向けに、総数が `DENSE_TOTAL`（32）を超えるとき `is-dense` クラスを付け、CSS で目盛りを消す。
  - 線の太さと色は `--inline-progress-tick-width`（既定 `1px`）と `--inline-progress-tick-color`（既定 `--background-primary`）、表示する 1 区画の最小の幅は `--inline-progress-tick-min-pitch`（既定 `4px`）で変えられる。
- 行の中央に揃えるため、外側は `height: 1lh` の箱にして `align-items: center`、`vertical-align: top` で行の上端に合わせる。`1lh` が使えない環境では `vertical-align: middle` にフォールバックする。
- 要素は `doc.createElement` で作る。`doc` は呼び出し側（`el.ownerDocument` / `view.dom.ownerDocument`）から渡し、ポップアウトウィンドウでも正しく動くようにする。

## 依存

- `@codemirror/state` / `@codemirror/view` / `@codemirror/language` は、型の参照用に `devDependencies` に入れる。実行時は Obsidian が提供するため、バンドルには入らない（`esbuild.config.mjs` の `external`）。
- `@codemirror/state` と `@codemirror/view` のバージョンは、`obsidian` パッケージの `peerDependencies` に合わせて固定している。

## 実機での確認状況

Obsidian（テーマ: Obsidian Nord）で、次の点を確認済み。

- 個数指定、位置指定、`,2/12`、`nolabel` の表示
- 満了時に塗りが `--text-success` の色になること
- 不正な値が置換されず、元のテキストのまま残ること
- インラインコードとフェンス付きコードブロックの中が置換されないこと
- ライブプレビューで、バーのクリックによる編集ができること
- Markdown の表の中でも、表示と、セル内での編集ができること（`;` 区切りのオプションを含む）
- 範囲指定（`3/13-26`、`13,15,18/13-26` など）が表示されること。ラベルの分母は範囲の区画数になる。
- 次の場所で表示されること: 見出し、文の途中、同じ行の複数、太字・斜体・取り消し線のあと、引用、コールアウト、入れ子のリスト、番号付きリスト、チェック済みのタスク
- 目盛り線（Chrome ヘッドレスでの確認）: 位置と本数（`10/12`、`2/4`、`1/1`）、幅 64px・128px・192px・文字サイズ 15px で、1区画がちょうど 4px のとき表示され、それ未満で消えること、閾値の変更（3px）、型付き算術が使えない場合のフォールバック（分母 33 以上で消える）

- 目盛り線の表示判定（Obsidian、テーマ: Obsidian Nord、閲覧モードの表）
  - 既定の幅（128px）では、分母 32（1区画 4px）まで目盛りが表示され、36 以上で消える。
  - 幅を `12em`（192px）にすると、分母 36〜43 で目盛りが表示され、64 以上で消える。
  - 幅を変えると境界が動くので、Obsidian 同梱の Chromium（142）でも、長さ ÷ 長さの判定が使えている。使えない環境の代替（分母 33 以上で消える）では、分母 36〜43 に目盛りは出ない。

未確認の点: 他のテーマ（Underwater など）での色、モバイルでの表示。
