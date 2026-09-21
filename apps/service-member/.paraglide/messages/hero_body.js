/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Hero_BodyInputs */

const ja_hero_body = /** @type {(inputs: Hero_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`自己紹介を書いて、気になる人を探せます。アカウントはパスキーと 2 段階認証で守れます。`)
};

const en_hero_body = /** @type {(inputs: Hero_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write an intro and find people you care about. Protect your account with passkeys and two-factor authentication.`)
};

/**
* | output |
* | --- |
* | "Write an intro and find people you care about. Protect your account with passkeys and two-factor authentication." |
*
* @param {Hero_BodyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const hero_body = /** @type {((inputs?: Hero_BodyInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hero_BodyInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_hero_body(inputs)
	return ja_hero_body(inputs)
});