/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Title_SupportInputs */

const ja_title_support = /** @type {(inputs: Title_SupportInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`お問い合わせ`)
};

const en_title_support = /** @type {(inputs: Title_SupportInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Contact`)
};

/**
* | output |
* | --- |
* | "Contact" |
*
* @param {Title_SupportInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const title_support = /** @type {((inputs?: Title_SupportInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_SupportInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_title_support(inputs)
	return ja_title_support(inputs)
});