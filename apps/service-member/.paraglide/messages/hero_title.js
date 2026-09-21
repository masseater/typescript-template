/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Hero_TitleInputs */

const ja_hero_title = /** @type {(inputs: Hero_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`自分のページを持つところから始まる`)
};

const en_hero_title = /** @type {(inputs: Hero_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Start by having your own page`)
};

/**
* | output |
* | --- |
* | "Start by having your own page" |
*
* @param {Hero_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const hero_title = /** @type {((inputs?: Hero_TitleInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hero_TitleInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_hero_title(inputs)
	return ja_hero_title(inputs)
});