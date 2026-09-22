/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Home_EmptyInputs */

const ja_home_empty = /** @type {(inputs: Home_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`フォローしている利用者の動きはまだありません。`)
};

const en_home_empty = /** @type {(inputs: Home_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No activity from people you follow yet.`)
};

/**
* | output |
* | --- |
* | "No activity from people you follow yet." |
*
* @param {Home_EmptyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const home_empty = /** @type {((inputs?: Home_EmptyInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Home_EmptyInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_home_empty(inputs)
	return ja_home_empty(inputs)
});