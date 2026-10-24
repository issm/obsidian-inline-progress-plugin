import type { ProgressData } from './parser';

/**
 * 区画が多く、既定の幅では目盛りが密になりすぎる総数のしきい値。
 *
 * 目盛りの濃さは、通常は CSS が「バーの幅 ÷ 総数」から決める。
 * CSS が長さ同士の割り算に対応していない環境では、これを超えたとき目盛りを消す。
 * 既定の幅（8em、16px で 128px）で、1区画が 4px になる総数。
 */
export const DENSE_TOTAL = 32;

/**
 * 進捗データから DOM を作る。閲覧モードとライブプレビューで共有する。
 *
 * <span class="inline-progress">                              全区画が塗られていれば is-complete、
 *                                                           区切りがあれば has-ticks、
 *                                                           区画が多ければ is-dense、
 *                                                           分母が仮なら is-tentative、
 *                                                           分母が不明なら is-unknown が付く
 *   <div class="inline-progress-track" role="progressbar">   固定幅
 *     <div class="inline-progress-fill"></div>               塗り領域（複数のことがある。分母不明なら無い）
 *   </div>
 *   <span class="inline-progress-label">3/12</span>          nolabel なら無い。分母が仮なら 3/12?、不明なら 3/??
 * </span>
 *
 * 塗り領域の位置と幅は、トラックに対する割合（0〜1）を CSS 変数で渡し、
 * 実際の値への変換は styles.css の calc() に任せる。
 *
 * @param doc 要素を作る Document。ポップアウトウィンドウでも正しく動くよう、呼び出し側から渡す。
 */
export function createProgressEl(data: ProgressData, doc: Document): HTMLElement {
	const { total } = data;
	// 分母が不明なら `??`、仮なら数字のうしろに `?` を付ける。
	const denominatorText = total === null ? '??' : `${total}${data.tentative ? '?' : ''}`;
	const labelText = `${data.filledCount}/${denominatorText}`;

	const root = doc.createElement('span');
	root.className = 'inline-progress';

	const track = doc.createElement('div');
	track.className = 'inline-progress-track';
	track.setAttribute('role', 'progressbar');
	track.setAttribute('aria-label', data.source);
	root.appendChild(track);

	if (total === null) {
		// 分母が不明。塗り領域は作らず、背景だけを別の見た目にする（styles.css の is-unknown）。
		// 最大値が分からないので、aria-valuenow / aria-valuemax は付けず（不確定の進捗として扱われる）、
		// 読み上げ用のテキストで完了数を伝える。
		root.classList.add('is-unknown');
		track.setAttribute('aria-valuetext', labelText);
	} else {
		// すべての区画が塗られたら完了とし、色を変えるための目印を付ける。
		if (data.filledCount === total) {
			root.classList.add('is-complete');
		}
		// 分母が仮のときの目印。塗りの色は styles.css が決める（完了より優先される）。
		if (data.tentative) {
			root.classList.add('is-tentative');
			// 仮であることを、読み上げでも伝える。
			track.setAttribute('aria-valuetext', labelText);
		}
		// 区切りが2つ以上あれば、目盛り線を描く。濃さは CSS が 1 区画の幅に応じて決める。
		if (total >= 2) {
			root.classList.add('has-ticks');
		}
		// 長さ同士の割り算に対応していない環境向けの目印（styles.css のフォールバックが使う）。
		if (total > DENSE_TOTAL) {
			root.classList.add('is-dense');
		}

		track.setAttribute('aria-valuemin', '0');
		track.setAttribute('aria-valuemax', String(total));
		track.setAttribute('aria-valuenow', String(data.filledCount));
		// 目盛り線の間隔（1区画の幅）を CSS で計算するために、総数を渡す。
		track.style.setProperty('--inline-progress-total', String(total));

		for (const range of data.ranges) {
			const fill = doc.createElement('div');
			fill.className = 'inline-progress-fill';
			fill.style.setProperty('--inline-progress-start', String((range.start - 1) / total));
			fill.style.setProperty(
				'--inline-progress-length',
				String((range.end - range.start + 1) / total),
			);
			track.appendChild(fill);
		}
	}

	if (data.showLabel) {
		const label = doc.createElement('span');
		label.className = 'inline-progress-label';
		label.textContent = labelText;
		root.appendChild(label);
	}

	return root;
}
