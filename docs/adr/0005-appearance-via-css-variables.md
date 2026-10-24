# 0005: 見た目の調整は CSS 変数に集約する

- 状態: 採用
- 日付: 2026-10-24

## 状況

バーの幅、太さ、左右の余白は、利用者の好みや使うテーマで変えたくなる。将来は設定画面から変えられるようにしたい。また、色はテーマに合わせたい。

## 決定

- 寸法は CSS 変数にし、`var(--変数名, 既定値)` で参照する。
  - `--inline-progress-width`（既定 `8em`）
  - `--inline-progress-height`（既定 `0.5em`）
  - `--inline-progress-margin`（既定 `0.4em`。`margin-inline` に使い、1つの値が左右の両側に効く）
    - [ADR 0011](0011-settings-reflected-via-css.md) で、`--inline-progress-margin-start` / `-end` に分けた。
- 色は、Obsidian のテーマ変数を使う。
  - 塗り: `--color-cyan`（当初は `--interactive-accent`。accent、blue、cyan の3案を Obsidian Nord で描画して比べ、cyan に決めた。明るく、トラックの背景との差が大きいので、歯抜けの細い塗りも読み取りやすい）
  - 完了時の塗り: `--text-success`
  - トラックの背景: `--background-modifier-border`
- 塗り領域の位置と幅は、割合（0〜1）を CSS 変数（`--inline-progress-start` / `--inline-progress-length`）で渡し、`calc()` で変換する。

## 検討した代替案

- 位置と幅を、JavaScript でインラインスタイル（`left: 16.67%` など）に直接書く。見た目の知識が、スタイルシートと JavaScript に分かれる。
- 寸法を JavaScript の定数にする。CSS スニペットで上書きできない。

## 結果

- 利用者は、CSS スニペットで変数を上書きするだけで、見た目を変えられる。
- 将来の設定画面は、保存した値をこれらの変数に反映するだけで済む。パーサーや描画のコードは変えなくてよい（ラベルの表示・内容の設定を除く）。→ 実際にそうした。ラベルの表示も CSS で切り替えている（[ADR 0011](0011-settings-reflected-via-css.md)）。
- 色はテーマに追従する。ただし、テーマが `--text-success` を定義していない場合は、Obsidian の既定（`--color-green`）に従う。
