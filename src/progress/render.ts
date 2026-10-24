import type { ProgressData } from './parser';

/**
 * 進捗データから DOM を作る。閲覧モードとライブプレビューで共有する。
 *
 * <span class="inline-progress">                              全区画が塗られていれば is-complete が付く
 *   <div class="inline-progress-track" role="progressbar">   固定幅
 *     <div class="inline-progress-fill"></div>               塗り領域（複数のことがある）
 *   </div>
 *   <span class="inline-progress-label">3/12</span>          nolabel なら無い
 * </span>
 *
 * 塗り領域の位置と幅は、トラックに対する割合（0〜1）を CSS 変数で渡し、
 * 実際の値への変換は styles.css の calc() に任せる。
 *
 * @param doc 要素を作る Document。ポップアウトウィンドウでも正しく動くよう、呼び出し側から渡す。
 */
export function createProgressEl(data: ProgressData, doc: Document): HTMLElement {
	const root = doc.createElement('span');
	root.className = 'inline-progress';
	// すべての区画が塗られたら完了とし、色を変えるための目印を付ける。
	if (data.filledCount === data.total) {
		root.classList.add('is-complete');
	}

	const track = doc.createElement('div');
	track.className = 'inline-progress-track';
	track.setAttribute('role', 'progressbar');
	track.setAttribute('aria-valuemin', '0');
	track.setAttribute('aria-valuemax', String(data.total));
	track.setAttribute('aria-valuenow', String(data.filledCount));
	track.setAttribute('aria-label', data.source);
	root.appendChild(track);

	for (const range of data.ranges) {
		const fill = doc.createElement('div');
		fill.className = 'inline-progress-fill';
		fill.style.setProperty('--inline-progress-start', String((range.start - 1) / data.total));
		fill.style.setProperty(
			'--inline-progress-length',
			String((range.end - range.start + 1) / data.total),
		);
		track.appendChild(fill);
	}

	if (data.showLabel) {
		const label = doc.createElement('span');
		label.className = 'inline-progress-label';
		label.textContent = `${data.filledCount}/${data.total}`;
		root.appendChild(label);
	}

	return root;
}
