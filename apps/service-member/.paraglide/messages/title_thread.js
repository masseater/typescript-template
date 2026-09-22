/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Title_ThreadInputs */

const ja_title_thread = /** @type {(inputs: Title_ThreadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`スレッド`)
};

const en_title_thread = /** @type {(inputs: Title_ThreadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Thread`)
};

/**
* | output |
* | --- |
* | "Thread" |
*
* @param {Title_ThreadInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const title_thread = /** @type {((inputs?: Title_ThreadInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_ThreadInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_title_thread(inputs)
	return ja_title_thread(inputs)
});