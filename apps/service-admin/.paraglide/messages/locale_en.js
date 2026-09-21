/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Locale_EnInputs */

const ja_locale_en = /** @type {(inputs: Locale_EnInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`English`)
};

const en_locale_en = /** @type {(inputs: Locale_EnInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`English`)
};

/**
* | output |
* | --- |
* | "English" |
*
* @param {Locale_EnInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const locale_en = /** @type {((inputs?: Locale_EnInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Locale_EnInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_locale_en(inputs)
	return ja_locale_en(inputs)
});