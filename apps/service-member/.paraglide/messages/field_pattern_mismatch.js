/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Field_Pattern_MismatchInputs */

const ja_field_pattern_mismatch = /** @type {(inputs: Field_Pattern_MismatchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`指定された形式で入力してください。`)
};

const en_field_pattern_mismatch = /** @type {(inputs: Field_Pattern_MismatchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Follow the requested format.`)
};

/**
* | output |
* | --- |
* | "Follow the requested format." |
*
* @param {Field_Pattern_MismatchInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const field_pattern_mismatch = /** @type {((inputs?: Field_Pattern_MismatchInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Pattern_MismatchInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_field_pattern_mismatch(inputs)
	return ja_field_pattern_mismatch(inputs)
});