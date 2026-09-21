/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Login_LinkInputs */

const ja_login_link = /** @type {(inputs: Login_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`ログイン`)
};

const en_login_link = /** @type {(inputs: Login_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Log in`)
};

/**
* | output |
* | --- |
* | "Log in" |
*
* @param {Login_LinkInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const login_link = /** @type {((inputs?: Login_LinkInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_LinkInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_login_link(inputs)
	return ja_login_link(inputs)
});