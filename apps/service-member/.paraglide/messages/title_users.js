/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Title_UsersInputs */

const ja_title_users = /** @type {(inputs: Title_UsersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`探す`)
};

const en_title_users = /** @type {(inputs: Title_UsersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search`)
};

/**
* | output |
* | --- |
* | "Search" |
*
* @param {Title_UsersInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const title_users = /** @type {((inputs?: Title_UsersInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_UsersInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_title_users(inputs)
	return ja_title_users(inputs)
});