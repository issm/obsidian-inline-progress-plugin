/**
 * `[progress:: 値; オプション]` 形式のインラインフィールドを解析する。
 * Obsidian API には依存しない純粋なモジュール。
 *
 * 値の書式（値の内側に空白は置けない）:
 *   10/12            先頭から10個分を塗る（個数指定）
 *   ,2/12            2番目だけを塗る（カンマを含むと位置指定になる）
 *   1,3,5/12         1・3・5番目を塗る（歯抜け）
 *   3/13-26          13〜26（両端を含む14個）のうち、先頭から3個分を塗る
 *   13,15,18/13-26   13〜26 のうち、13・15・18 を塗る（位置は範囲内の番号そのまま）
 *
 * `/` のうしろが `総数` のとき、範囲は `1-総数` と同じ。
 * 描画には、範囲の開始値を引いて 1 始まりに換算した位置を渡す。ラベルの分母は範囲の個数。
 *
 * 分母が不明な書式（`total` が null になる）:
 *   5/?  5/-         `?` または `-` だけ
 *   5/13-?  5/13-    範囲の終了が不明
 *   5/?-26  5/-26    範囲の開始が不明
 *   5/?-?  5/-?  5/?-  どちらも不明
 * 分母が不明なときは、塗り領域を作らない。位置指定でも、位置の範囲は検査せず、重複を除いた個数を完了数とする。
 *
 * 仮の分母（`tentative` が true になる）: 分母の数字のうしろに `?` を付ける。
 *   5/12?  5/13?-26  5/13-25?  5/13?-25?
 * 分母の値としては `?` を付けないときと同じ扱い（塗りも検査も同じ）。仮であることだけを表示で区別する。
 * 範囲の端が `?` だけ（`13-?`）や省略（`13-`）のときは、仮ではなく分母不明。
 *
 * オプション（`;` 区切り。複数指定できる）:
 *   nolabel    ラベル（塗られた数/総数）を表示しない
 */

/** 塗る範囲。1始まりで、start と end を含む。 */
export interface FilledRange {
	start: number;
	end: number;
}

export interface ProgressData {
	/** 区画の総数。分母が不明なときは null（このとき ranges は空）。 */
	total: number | null;
	/** 分母が仮のとき true（分母の数字に `?` が付いている）。total が null のときは常に false。 */
	tentative: boolean;
	/** 塗られる範囲。昇順で、隣接する位置は1つにまとめてある。 */
	ranges: readonly FilledRange[];
	/** 塗られる区画の数 */
	filledCount: number;
	showLabel: boolean;
	/** 値の部分の元の表記（アクセシビリティ用ラベルに使う） */
	source: string;
}

export interface ProgressField {
	/** ノートのテキスト内での開始位置 */
	from: number;
	/** ノートのテキスト内での終了位置（含まない） */
	to: number;
	data: ProgressData;
}

/** フィールド全体にマッチさせる。1行内で完結するものだけを対象にする。 */
const FIELD_PATTERN = /\[progress::([^\]\n]*)\]/g;

/**
 * 値の部分: `完了/分母`。空白は許容しない。
 *   1: 完了（数字とカンマ）  2: 分母（`総数`、`開始-終了`、`?`、`-` など。後で解析する）
 */
const VALUE_PATTERN = /^([\d,]+)\/(.+)$/;

/** 分母が `総数` の形。数字のうしろの `?` は、仮の分母を表す。 */
const TOTAL_PATTERN = /^(\d+)(\?)?$/;

/** 分母が `開始-終了` の形。各端は数字（うしろに `?` で仮）、`?`（不明）、または省略（不明）。 */
const RANGE_PATTERN = /^(\d+\??|\?)?-(\d+\??|\?)?$/;

/**
 * 分母の解析結果。known は範囲 first〜last（両端を含む）で、tentative は端のどちらかに `?` が付いていること。
 * unknown は分母不明。
 */
type Denominator =
	| { kind: 'known'; first: number; last: number; tentative: boolean }
	| { kind: 'unknown' };

/** 範囲の端（`13`、`13?`、`?`、省略）を解析する。不明（`?` または省略）なら null。 */
function parseEndpoint(text: string | undefined): { value: number; tentative: boolean } | null {
	if (text === undefined || text === '?') return null;
	const tentative = text.endsWith('?');
	return { value: Number(tentative ? text.slice(0, -1) : text), tentative };
}

/**
 * 分母の部分（`12`、`12?`、`13-26`、`13?-25?`、`?`、`13-` など）を解析する。書式が不正なら null。
 */
function parseDenominator(text: string): Denominator | null {
	// `総数` は `1-総数` と同じ。
	const total = TOTAL_PATTERN.exec(text);
	if (total) {
		return { kind: 'known', first: 1, last: Number(total[1]), tentative: total[2] !== undefined };
	}
	if (text === '?') return { kind: 'unknown' };

	const range = RANGE_PATTERN.exec(text);
	if (!range) return null;
	const start = parseEndpoint(range[1]);
	const end = parseEndpoint(range[2]);
	// 両端が数字のときだけ、範囲が確定する。どちらかが省略または `?` だけなら、分母は不明。
	if (start === null || end === null) return { kind: 'unknown' };
	return {
		kind: 'known',
		first: start.value,
		last: end.value,
		tentative: start.tentative || end.tentative,
	};
}

const OPTION_NO_LABEL = 'nolabel';

/** 位置の集合を、連続する範囲にまとめる。 */
function toRanges(positions: Iterable<number>): FilledRange[] {
	const sorted = [...new Set(positions)].sort((a, b) => a - b);
	const ranges: FilledRange[] = [];
	for (const position of sorted) {
		const last = ranges[ranges.length - 1];
		if (last && last.end + 1 === position) {
			last.end = position;
		} else {
			ranges.push({ start: position, end: position });
		}
	}
	return ranges;
}

function countFilled(ranges: readonly FilledRange[]): number {
	return ranges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
}

/**
 * 分母が不明な値を解析する。区画の数が分からないので塗り領域は作らず、完了数だけを数える。
 * 位置指定でも、位置が範囲内かは検査しない。完了数は、重複を除いた位置の個数。
 */
function parseWithUnknownTotal(
	list: string,
	source: string,
): Omit<ProgressData, 'showLabel'> | null {
	let filledCount: number;
	if (list.includes(',')) {
		const positions = list
			.split(',')
			.filter((s) => s !== '')
			.map(Number);
		if (positions.length === 0 || !positions.every((p) => Number.isSafeInteger(p))) return null;
		filledCount = new Set(positions).size;
	} else {
		filledCount = Number(list);
		if (!Number.isSafeInteger(filledCount)) return null;
	}
	return { total: null, tentative: false, ranges: [], filledCount, source };
}

/**
 * 値の部分（例: `1,3,5/12`）を解析する。不正なら null。
 */
function parseValue(value: string): Omit<ProgressData, 'showLabel'> | null {
	const match = VALUE_PATTERN.exec(value);
	const list = match?.[1];
	const denominatorText = match?.[2];
	if (list === undefined || denominatorText === undefined) return null;

	const denominator = parseDenominator(denominatorText);
	if (!denominator) return null;
	if (denominator.kind === 'unknown') return parseWithUnknownTotal(list, value);

	// 対象の範囲 first〜last（両端を含む）。`/12` は `1-12` と同じ。
	// 仮の分母（tentative）でも、値の扱いは `?` が無いときと同じ。
	const { first, last, tentative } = denominator;
	if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return null;
	// 開始が終了を超える範囲（`26-13`）と、総数 0（`/0` は `1-0` になる）は不正。
	if (first > last) return null;
	// 範囲の個数（ラベルの分母）。
	const total = last - first + 1;

	let ranges: FilledRange[];
	if (list.includes(',')) {
		// 位置指定。空要素（先頭・末尾・連続のカンマ）は無視する。
		const positions = list
			.split(',')
			.filter((s) => s !== '')
			.map(Number);
		if (positions.length === 0) return null;
		if (!positions.every((p) => Number.isSafeInteger(p) && p >= first && p <= last)) {
			return null;
		}
		// 範囲内の番号を、1 始まりの区画の番号に換算する。
		ranges = toRanges(positions.map((p) => p - first + 1));
	} else {
		// 個数指定。
		const count = Number(list);
		if (!Number.isSafeInteger(count) || count > total) return null;
		ranges = count > 0 ? [{ start: 1, end: count }] : [];
	}

	return { total, tentative, ranges, filledCount: countFilled(ranges), source: value };
}

/**
 * フィールドの中身（`[progress::` と `]` の間）を解析する。不正なら null。
 */
export function parseProgress(body: string): ProgressData | null {
	const [valuePart = '', ...optionParts] = body.split(';');

	const parsed = parseValue(valuePart.trim());
	if (!parsed) return null;

	let showLabel = true;
	for (const optionPart of optionParts) {
		const option = optionPart.trim();
		if (option === '') continue;
		if (option === OPTION_NO_LABEL) {
			showLabel = false;
		} else {
			// 未知のオプションは不正値として扱い、typo に気づけるようにする。
			return null;
		}
	}

	return { ...parsed, showLabel };
}

/**
 * テキスト内の `[progress:: …]` をすべて探す。解析できないものは含めない。
 */
export function findProgressFields(text: string): ProgressField[] {
	const fields: ProgressField[] = [];
	for (const match of text.matchAll(FIELD_PATTERN)) {
		const data = parseProgress(match[1] ?? '');
		if (data) {
			fields.push({
				from: match.index,
				to: match.index + match[0].length,
				data,
			});
		}
	}
	return fields;
}
