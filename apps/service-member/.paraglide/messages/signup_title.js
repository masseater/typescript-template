/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_TitleInputs */

const ja_signup_title = /** @type {(inputs: Signup_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`新規登録`)
};

const en_signup_title = /** @type {(inputs: Signup_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sign up`)
};

/**
* | output |
* | --- |
* | "Sign up" |
*
* @param {Signup_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const signup_title = /** @type {((inputs?: Signup_TitleInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_TitleInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_title(inputs)
	return ja_signup_title(inputs)
});