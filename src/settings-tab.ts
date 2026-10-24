import { App, PluginSettingTab, Setting } from 'obsidian';
import type InlineProgressPlugin from './main';
import { CSS_SETTINGS, DEFAULT_SETTINGS, isValidCssValue } from './settings';

export class InlineProgressSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: InlineProgressPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		// 設定画面だけに効く CSS の目印（styles.css のプレースホルダーの色）。
		containerEl.addClass('inline-progress-settings');

		new Setting(containerEl)
			.setName('Label')
			.setDesc('個別のフィールドでは、オプションの label / nolabel が優先されます。')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showLabel).onChange(async (value) => {
					this.plugin.settings.showLabel = value;
					await this.plugin.saveSettings();
				}),
			)
			.setName('Show label by default');

		new Setting(containerEl)
			.setName('Appearance')
			.setDesc('空欄のときは、テーマと styles.css の既定値に従います。値は CSS の書き方で入力します（例: 12em）。')
			.setHeading();

		for (const def of CSS_SETTINGS) {
			new Setting(containerEl)
				.setName(def.name)
				.setDesc(def.desc)
				.addText((text) =>
					text
						.setPlaceholder(def.placeholder)
						.setValue(this.plugin.settings[def.key])
						.onChange(async (value) => {
							const valid = isValidCssValue(def, value);
							text.inputEl.toggleClass('mod-warning', !valid);
							if (!valid) return; // 不正な間は保存・反映しない
							this.plugin.settings[def.key] = value.trim();
							await this.plugin.saveSettings();
						}),
				)
				.addExtraButton((button) =>
					button
						.setIcon('reset')
						.setTooltip('Reset to default')
						.onClick(async () => {
							this.plugin.settings[def.key] = DEFAULT_SETTINGS[def.key];
							await this.plugin.saveSettings();
							this.display();
						}),
				);
		}
	}
}
