/**
 * `[progress:: 値; オプション]` 形式のインラインフィールドを解析する。
 * Obsidian API には依存しない純粋なモジュール。
 *
 * 値の書式（値の内側に空白は置けない）:
 *   10/12      先頭から10個分を塗る（個数指定）
 *   ,2/12      2番目だけを塗る（カンマを含むと位置指定になる）
 *   1,3,5/12   1・3・5番目を塗る（歯抜け）
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
	/** 区画の総数 */
	total: number;
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

/** 値の部分: 数字とカンマ、スラッシュ、総数。空白は許容しない。 */
const VALUE_PATTERN = /^([\d,]+)\/(\d+)$/;

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
 * 値の部分（例: `1,3,5/12`）を解析する。不正なら null。
 */
function parseValue(value: string): Omit<ProgressData, 'showLabel'> | null {
	const match = VALUE_PATTERN.exec(value);
	const list = match?.[1];
	const totalText = match?.[2];
	if (list === undefined || totalText === undefined) return null;

	const total = Number(totalText);
	if (!Number.isSafeInteger(total) || total < 1) return null;

	let ranges: FilledRange[];
	if (list.includes(',')) {
		// 位置指定。空要素（先頭・末尾・連続のカンマ）は無視する。
		const positions = list
			.split(',')
			.filter((s) => s !== '')
			.map(Number);
		if (positions.length === 0) return null;
		if (!positions.every((p) => Number.isSafeInteger(p) && p >= 1 && p <= total)) {
			return null;
		}
		ranges = toRanges(positions);
	} else {
		// 個数指定。
		const count = Number(list);
		if (!Number.isSafeInteger(count) || count > total) return null;
		ranges = count > 0 ? [{ start: 1, end: count }] : [];
	}

	return { total, ranges, filledCount: countFilled(ranges), source: value };
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
