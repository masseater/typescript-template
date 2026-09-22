/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Field_Type_MismatchInputs */

const ja_field_type_mismatch = /** @type {(inputs: Field_Type_MismatchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`正しい形式で入力してください。`)
};

const en_field_type_mismatch = /** @type {(inputs: Field_Type_MismatchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter a valid format.`)
};

/**
* | output |
* | --- |
* | "Enter a valid format." |
*
* @param {Field_Type_MismatchInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const field_type_mismatch = /** @type {((inputs?: Field_Type_MismatchInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Type_MismatchInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_field_type_mismatch(inputs)
	return ja_field_type_mismatch(inputs)
});