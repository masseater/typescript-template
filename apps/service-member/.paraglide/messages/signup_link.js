/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_LinkInputs */

const ja_signup_link = /** @type {(inputs: Signup_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`新規登録`)
};

const en_signup_link = /** @type {(inputs: Signup_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sign up`)
};

/**
* | output |
* | --- |
* | "Sign up" |
*
* @param {Signup_LinkInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const signup_link = /** @type {((inputs?: Signup_LinkInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_LinkInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_link(inputs)
	return ja_signup_link(inputs)
});