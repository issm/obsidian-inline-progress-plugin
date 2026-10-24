import { findProgressFields } from './parser';
import { createProgressEl } from './render';

/**
 * 閲覧モード用。描画済みの HTML 内にある `[progress:: …]` を進捗バーに置き換える。
 * `registerMarkdownPostProcessor` に渡す。
 */
export function processProgressFields(el: HTMLElement): void {
	const doc = el.ownerDocument;

	// 走査中に DOM を書き換えると壊れるので、先に対象のテキストノードを集める。
	const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	const targets: Text[] = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		// コード（インライン・ブロック）の中は置き換えない。
		if (node.parentElement?.closest('code, pre')) continue;
		if (node.nodeValue?.includes('[progress::')) targets.push(node as Text);
	}

	for (const textNode of targets) {
		const text = textNode.nodeValue ?? '';
		const fields = findProgressFields(text);
		if (fields.length === 0) continue;

		// 前後のテキストを残しつつ、フィールドの部分だけを要素に差し替える。
		const fragment = doc.createDocumentFragment();
		let cursor = 0;
		for (const field of fields) {
			fragment.appendChild(doc.createTextNode(text.slice(cursor, field.from)));
			fragment.appendChild(createProgressEl(field.data, doc));
			cursor = field.to;
		}
		fragment.appendChild(doc.createTextNode(text.slice(cursor)));
		textNode.replaceWith(fragment);
	}
}
