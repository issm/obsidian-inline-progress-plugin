import { Plugin } from 'obsidian';
import { progressLivePreview } from './progress/live-preview';
import { processProgressFields } from './progress/reading-view';

export default class InlineProgressPlugin extends Plugin {
	onload() {
		// 閲覧モード: 描画済みの HTML を書き換える。
		this.registerMarkdownPostProcessor((el) => processProgressFields(el));
		// ライブプレビュー: エディタ（CodeMirror 6）の表示を置き換える。
		this.registerEditorExtension(progressLivePreview);
	}
}
