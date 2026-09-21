/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Nav_BoardInputs */

const ja_nav_board = /** @type {(inputs: Nav_BoardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`掲示板`)
};

const en_nav_board = /** @type {(inputs: Nav_BoardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Board`)
};

/**
* | output |
* | --- |
* | "Board" |
*
* @param {Nav_BoardInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const nav_board = /** @type {((inputs?: Nav_BoardInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Nav_BoardInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_nav_board(inputs)
	return ja_nav_board(inputs)
});