import { App, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
import type InlineProgressPlugin from './main';
import { CSS_SETTINGS, isValidCssValue } from './settings';

export class InlineProgressSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: InlineProgressPlugin,
	) {
		super(app, plugin);
		// 設定画面だけに効く CSS の目印（styles.css のプレースホルダーの色）。
		this.containerEl.addClass('inline-progress-settings');
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Show label by default',
				desc: '個別のフィールドでは、オプションの label / nolabel が優先されます。',
				control: { type: 'toggle', key: 'showLabel' },
			},
			{
				type: 'group',
				heading: 'Appearance',
				items: CSS_SETTINGS.map((def) => ({
					name: def.name,
					desc: `${def.desc}空欄のときは既定値に従います。CSS の書き方で入力します（例: 12em）。`,
					control: {
						type: 'text',
						key: def.key,
						placeholder: def.placeholder,
						validate: (value: string) =>
							isValidCssValue(def, value) ? undefined : '有効な CSS の値ではありません。',
					},
				})),
			},
		];
	}

	// 既定の実装は保存だけなので、保存に加えて表示への反映も行う。
	async setControlValue(key: string, value: unknown): Promise<void> {
		const settings = this.plugin.settings as unknown as Record<string, unknown>;
		settings[key] = typeof value === 'string' ? value.trim() : value;
		await this.plugin.saveSettings();
	}
}
