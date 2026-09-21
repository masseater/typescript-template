/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Field_Too_ShortInputs */

const ja_field_too_short = /** @type {(inputs: Field_Too_ShortInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`文字数が足りません。`)
};

const en_field_too_short = /** @type {(inputs: Field_Too_ShortInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Not enough characters.`)
};

/**
* | output |
* | --- |
* | "Not enough characters." |
*
* @param {Field_Too_ShortInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const field_too_short = /** @type {((inputs?: Field_Too_ShortInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Too_ShortInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_field_too_short(inputs)
	return ja_field_too_short(inputs)
});