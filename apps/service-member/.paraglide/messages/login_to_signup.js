/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Login_To_SignupInputs */

const ja_login_to_signup = /** @type {(inputs: Login_To_SignupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`アカウントをお持ちでない方は`)
};

const en_login_to_signup = /** @type {(inputs: Login_To_SignupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Don't have an account?`)
};

/**
* | output |
* | --- |
* | "Don't have an account?" |
*
* @param {Login_To_SignupInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const login_to_signup = /** @type {((inputs?: Login_To_SignupInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_To_SignupInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_login_to_signup(inputs)
	return ja_login_to_signup(inputs)
});