/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Home_LoadingInputs */

const ja_home_loading = /** @type {(inputs: Home_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`読み込み中です。`)
};

const en_home_loading = /** @type {(inputs: Home_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Loading.`)
};

/**
* | output |
* | --- |
* | "Loading." |
*
* @param {Home_LoadingInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const home_loading = /** @type {((inputs?: Home_LoadingInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Home_LoadingInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_home_loading(inputs)
	return ja_home_loading(inputs)
});