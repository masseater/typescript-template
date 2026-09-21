/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Locale_JaInputs */

const ja_locale_ja = /** @type {(inputs: Locale_JaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`日本語`)
};

const en_locale_ja = /** @type {(inputs: Locale_JaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`日本語`)
};

/**
* | output |
* | --- |
* | "日本語" |
*
* @param {Locale_JaInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const locale_ja = /** @type {((inputs?: Locale_JaInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Locale_JaInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_locale_ja(inputs)
	return ja_locale_ja(inputs)
});