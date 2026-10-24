import { syntaxTree } from '@codemirror/language';
import { EditorState, RangeSetBuilder } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';
import { findProgressFields, ProgressData } from './parser';
import { createProgressEl } from './render';

class ProgressWidget extends WidgetType {
	constructor(
		private readonly data: ProgressData,
		/** 元のテキスト。同じ表記なら DOM を作り直さないための比較に使う。 */
		private readonly sourceText: string,
	) {
		super();
	}

	eq(other: ProgressWidget): boolean {
		return this.sourceText === other.sourceText;
	}

	toDOM(view: EditorView): HTMLElement {
		return createProgressEl(this.data, view.dom.ownerDocument);
	}

	// false にして、ウィジェット上のクリックをエディタに処理させる。
	// これでクリックするとカーソルが入り、元のテキストを編集できる。
	ignoreEvent(): boolean {
		return false;
	}
}

/** その位置がコード（インライン・ブロック）の中かどうか。 */
function isInCode(state: EditorState, pos: number): boolean {
	const tree = syntaxTree(state);
	// 自分から親へたどり、コードを表すノード名（inline-code, HyperMD-codeblock など）があるか調べる。
	let node: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(pos, 1);
	while (node) {
		if (node.name.toLowerCase().includes('code')) return true;
		node = node.parent;
	}
	return false;
}

function buildDecorations(view: EditorView): DecorationSet {
	const { state } = view;
	// ソースモードでは置き換えない。
	if (!state.field(editorLivePreviewField)) return Decoration.none;

	const builder = new RangeSetBuilder<Decoration>();
	// RangeSetBuilder は位置の昇順でしか追加できないので、追加済みの末尾を覚えておく。
	let lastTo = -1;

	for (const visible of view.visibleRanges) {
		// 表示範囲の境目でフィールドが分断されないよう、行の端まで広げる。
		const start = state.doc.lineAt(visible.from).from;
		const end = state.doc.lineAt(visible.to).to;
		const text = state.sliceDoc(start, end);

		for (const field of findProgressFields(text)) {
			const from = start + field.from;
			const to = start + field.to;
			if (from < lastTo) continue;

			// カーソルや選択範囲が触れているときは、編集できるよう元のテキストを見せる。
			const touched = state.selection.ranges.some((r) => r.from <= to && r.to >= from);
			if (touched) continue;

			if (isInCode(state, from)) continue;

			builder.add(
				from,
				to,
				Decoration.replace({
					widget: new ProgressWidget(field.data, text.slice(field.from, field.to)),
				}),
			);
			lastTo = to;
		}
	}
	return builder.finish();
}

/** ライブプレビュー用の CodeMirror 拡張。`registerEditorExtension` に渡す。 */
export const progressLivePreview = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}

		update(update: ViewUpdate): void {
			const modeChanged =
				update.startState.field(editorLivePreviewField) !==
				update.state.field(editorLivePreviewField);
			// 構文解析が進んだときにも、コード判定をやり直す。
			const treeChanged = syntaxTree(update.startState) !== syntaxTree(update.state);

			if (
				update.docChanged ||
				update.viewportChanged ||
				update.selectionSet ||
				modeChanged ||
				treeChanged
			) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{
		decorations: (plugin) => plugin.decorations,
	},
);
