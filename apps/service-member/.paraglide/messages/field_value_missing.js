/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Field_Value_MissingInputs */

const ja_field_value_missing = /** @type {(inputs: Field_Value_MissingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`入力してください。`)
};

const en_field_value_missing = /** @type {(inputs: Field_Value_MissingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter a value.`)
};

/**
* | output |
* | --- |
* | "Enter a value." |
*
* @param {Field_Value_MissingInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const field_value_missing = /** @type {((inputs?: Field_Value_MissingInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Value_MissingInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_field_value_missing(inputs)
	return ja_field_value_missing(inputs)
});