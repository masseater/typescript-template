/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Consequences_TitleInputs */

const ja_consequences_title = /** @type {(inputs: Consequences_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`ページを持つと`)
};

const en_consequences_title = /** @type {(inputs: Consequences_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Once you have a page`)
};

/**
* | output |
* | --- |
* | "Once you have a page" |
*
* @param {Consequences_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const consequences_title = /** @type {((inputs?: Consequences_TitleInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Consequences_TitleInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_consequences_title(inputs)
	return ja_consequences_title(inputs)
});