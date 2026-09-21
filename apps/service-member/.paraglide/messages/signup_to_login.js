/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_To_LoginInputs */

const ja_signup_to_login = /** @type {(inputs: Signup_To_LoginInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`アカウントをお持ちの方は`)
};

const en_signup_to_login = /** @type {(inputs: Signup_To_LoginInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Already have an account?`)
};

/**
* | output |
* | --- |
* | "Already have an account?" |
*
* @param {Signup_To_LoginInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const signup_to_login = /** @type {((inputs?: Signup_To_LoginInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_To_LoginInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_to_login(inputs)
	return ja_signup_to_login(inputs)
});