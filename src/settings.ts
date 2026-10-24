/**
 * 設定の型・既定値・検証と、CSS 変数への反映。
 *
 * 見た目の設定は `--inline-progress-*` 変数として body に設定する（ADR 0005）。
 * 空文字は「未設定」で、styles.css の既定値に従う。
 * ラベルの既定の表示（`showLabel`）は、body のクラスで切り替える。
 */

export interface InlineProgressSettings {
	/** ラベルを既定で表示するか。記法の `label` / `nolabel` で個別に上書きできる。 */
	showLabel: boolean;
	width: string;
	height: string;
	marginStart: string;
	marginEnd: string;
}

export const DEFAULT_SETTINGS: InlineProgressSettings = {
	showLabel: true,
	width: '',
	height: '',
	marginStart: '',
	marginEnd: '',
};

/** ラベルを既定で表示しないとき、body に付けるクラス。 */
const HIDE_LABEL_CLASS = 'inline-progress-hide-label';

/** CSS 変数に反映する設定のキー（文字列で持つもの）。 */
export type CssSettingKey = 'width' | 'height' | 'marginStart' | 'marginEnd';

export interface CssSettingDefinition {
	key: CssSettingKey;
	cssVar: string;
	/** 値の検証に使う CSS プロパティ（`CSS.supports` に渡す）。 */
	cssProp: string;
	name: string;
	desc: string;
	/** 未設定時の既定値（入力欄のプレースホルダーに出す）。 */
	placeholder: string;
}

export const CSS_SETTINGS: readonly CssSettingDefinition[] = [
	{ key: 'width', cssVar: '--inline-progress-width', cssProp: 'width', name: 'Bar width', desc: 'バーの幅。', placeholder: '8em' },
	{ key: 'height', cssVar: '--inline-progress-height', cssProp: 'height', name: 'Bar thickness', desc: 'バーの太さ。', placeholder: '0.5em' },
	{ key: 'marginStart', cssVar: '--inline-progress-margin-start', cssProp: 'margin-inline-start', name: 'Start margin', desc: '左側の余白。', placeholder: '0.4em' },
	{ key: 'marginEnd', cssVar: '--inline-progress-margin-end', cssProp: 'margin-inline-end', name: 'End margin', desc: '右側の余白。', placeholder: '0.4em' },
];

/** 空（未設定）、または CSS として有効な値なら true。 */
export function isValidCssValue(def: CssSettingDefinition, value: string): boolean {
	const v = value.trim();
	return v === '' || CSS.supports(def.cssProp, v);
}

/** 保存データを読み込む。型の合わない値や不正な値は、既定値に落とす。 */
export function normalizeSettings(data: unknown): InlineProgressSettings {
	const result: InlineProgressSettings = { ...DEFAULT_SETTINGS };
	if (typeof data !== 'object' || data === null) return result;
	const record = data as Record<string, unknown>;

	if (typeof record.showLabel === 'boolean') result.showLabel = record.showLabel;
	for (const def of CSS_SETTINGS) {
		const value = record[def.key];
		if (typeof value === 'string' && isValidCssValue(def, value)) {
			result[def.key] = value.trim();
		}
	}
	return result;
}

/** 設定値を body の CSS 変数に反映する。未設定の項目は変数を外す。 */
export function applySettings(body: HTMLElement, settings: InlineProgressSettings): void {
	// ラベルの既定の表示は、body のクラスで切り替える（styles.css が対応する）。
	// 描画済みの要素を作り直さなくても、閲覧モード・ライブプレビュー・テーブルのセルのすべてに反映される。
	body.classList.toggle(HIDE_LABEL_CLASS, !settings.showLabel);
	for (const def of CSS_SETTINGS) {
		const value = settings[def.key].trim();
		if (value === '') {
			body.style.removeProperty(def.cssVar);
		} else {
			body.style.setProperty(def.cssVar, value);
		}
	}
}

/** body に設定した CSS 変数をすべて外す（プラグインの無効化時）。 */
export function clearSettings(body: HTMLElement): void {
	body.classList.remove(HIDE_LABEL_CLASS);
	for (const def of CSS_SETTINGS) {
		body.style.removeProperty(def.cssVar);
	}
}
