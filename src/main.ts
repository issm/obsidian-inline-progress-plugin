import { Plugin } from 'obsidian';
import { progressLivePreview } from './progress/live-preview';
import { processProgressFields } from './progress/reading-view';
import {
	DEFAULT_SETTINGS,
	InlineProgressSettings,
	applySettings,
	clearSettings,
	normalizeSettings,
} from './settings';
import { InlineProgressSettingTab } from './settings-tab';

export default class InlineProgressPlugin extends Plugin {
	settings: InlineProgressSettings = { ...DEFAULT_SETTINGS };

	async onload() {
		this.settings = normalizeSettings(await this.loadData());
		this.addSettingTab(new InlineProgressSettingTab(this.app, this));

		// 設定は body の CSS 変数とクラスに反映する。ポップアウトウィンドウにも反映する。
		this.applyToAllWindows();
		this.registerEvent(
			this.app.workspace.on('window-open', (_workspaceWindow, win) => {
				applySettings(win.document.body, this.settings);
			}),
		);

		// 閲覧モード: 描画済みの HTML を書き換える。
		this.registerMarkdownPostProcessor((el) => processProgressFields(el));
		// ライブプレビュー: エディタ（CodeMirror 6）の表示を置き換える。
		this.registerEditorExtension(progressLivePreview);
	}

	onunload() {
		clearSettings(document.body);
		this.app.workspace.iterateAllLeaves((leaf) => {
			clearSettings(leaf.view.containerEl.ownerDocument.body);
		});
	}

	/** 設定を保存し、反映する。表示済みの要素は作り直さず、CSS だけで切り替わる。 */
	async saveSettings() {
		await this.saveData(this.settings);
		this.applyToAllWindows();
	}

	private applyToAllWindows() {
		applySettings(document.body, this.settings);
		this.app.workspace.iterateAllLeaves((leaf) => {
			applySettings(leaf.view.containerEl.ownerDocument.body, this.settings);
		});
	}
}
