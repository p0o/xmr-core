import { trimRight, padLeft } from "@xmr-core/xmr-str-utils";
import { BigInt } from "@xmr-core/biginteger";
import { config } from "@xmr-core/xmr-constants";
import { ParsedTarget } from "./types";

export function formatMoneyFull(units: BigInt | string) {
	let strUnits = units.toString();
	const symbol = strUnits[0] === "-" ? "-" : "";
	if (symbol === "-") {
		strUnits = strUnits.slice(1);
	}
	let decimal;
	if (strUnits.length >= config.coinUnitPlaces) {
		decimal = strUnits.substr(
			strUnits.length - config.coinUnitPlaces,
			config.coinUnitPlaces,
		);
	} else {
		decimal = padLeft(strUnits, config.coinUnitPlaces, "0");
	}
	return (
		symbol +
		(strUnits.substr(0, strUnits.length - config.coinUnitPlaces) || "0") +
		"." +
		decimal
	);
}

export function formatMoneyFullWithSymbol(units: BigInt | string) {
	return formatMoneyFull(units) + " " + config.coinSymbol;
}

export function formatMoney(units: BigInt | string) {
	const f = trimRight(formatMoneyFull(units), "0");
	if (f[f.length - 1] === ".") {
		return f.slice(0, f.length - 1);
	}
	return f;
}

export function formatMoneyWithSymbol(units: BigInt | string) {
	return formatMoney(units) + " " + config.coinSymbol;
}

export function printDsts(dsts: ParsedTarget[]) {
	for (let i = 0; i < dsts.length; i++) {
		console.log(dsts[i].address + ": " + formatMoneyFull(dsts[i].amount));
	}
}
