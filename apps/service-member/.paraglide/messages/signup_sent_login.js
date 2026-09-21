/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Sent_LoginInputs */

const ja_signup_sent_login = /** @type {(inputs: Signup_Sent_LoginInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`ログインへ`)
};

const en_signup_sent_login = /** @type {(inputs: Signup_Sent_LoginInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Go to log in`)
};

/**
* | output |
* | --- |
* | "Go to log in" |
*
* @param {Signup_Sent_LoginInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const signup_sent_login = /** @type {((inputs?: Signup_Sent_LoginInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Sent_LoginInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_sent_login(inputs)
	return ja_signup_sent_login(inputs)
});