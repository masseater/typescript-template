/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Login_TitleInputs */

const ja_admin_login_title = /** @type {(inputs: Admin_Login_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`管理者ログイン`)
};

const en_admin_login_title = /** @type {(inputs: Admin_Login_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Admin log in`)
};

/**
* | output |
* | --- |
* | "Admin log in" |
*
* @param {Admin_Login_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_login_title = /** @type {((inputs?: Admin_Login_TitleInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Login_TitleInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_login_title(inputs)
	return ja_admin_login_title(inputs)
});