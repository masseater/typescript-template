/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Field_Too_LongInputs */

const ja_field_too_long = /** @type {(inputs: Field_Too_LongInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`文字数が多すぎます。`)
};

const en_field_too_long = /** @type {(inputs: Field_Too_LongInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Too many characters.`)
};

/**
* | output |
* | --- |
* | "Too many characters." |
*
* @param {Field_Too_LongInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const field_too_long = /** @type {((inputs?: Field_Too_LongInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Too_LongInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_field_too_long(inputs)
	return ja_field_too_long(inputs)
});