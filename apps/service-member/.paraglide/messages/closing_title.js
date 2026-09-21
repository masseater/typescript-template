/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Closing_TitleInputs */

const ja_closing_title = /** @type {(inputs: Closing_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`さっそく始めましょう`)
};

const en_closing_title = /** @type {(inputs: Closing_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Let's get started`)
};

/**
* | output |
* | --- |
* | "Let's get started" |
*
* @param {Closing_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const closing_title = /** @type {((inputs?: Closing_TitleInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Closing_TitleInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_closing_title(inputs)
	return ja_closing_title(inputs)
});