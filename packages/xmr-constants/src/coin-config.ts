import { BigInt } from "@xmr-core/biginteger";

export interface XMRConfig {
	readonly coinUnitPlaces: 12;
	readonly coinUnits: BigInt;
	readonly txMinConfirms: 10;
	readonly coinSymbol: "XMR";
	readonly openAliasPrefix: "xmr";
	readonly coinName: "Monero";
	readonly coinUriPrefix: "monero:";
	readonly addressPrefix: 18;
	readonly integratedAddressPrefix: 19;
	readonly subaddressPrefix: 42;
	readonly dustThreshold: BigInt;
	readonly maxBlockNumber: 500000000;
	readonly avgBlockTime: 60;
}

const coinUnitPlaces = 12;

export const config: XMRConfig = {
	// Number of atomic units in one unit of currency. e.g. 12 => 10^12 = 1000000000000
	coinUnitPlaces,

	coinUnits: new BigInt(10).pow(coinUnitPlaces),

	// Minimum number of confirmations for a transaction to show as confirmed
	txMinConfirms: 10,

	// Currency symbol
	coinSymbol: "XMR",

	// OpenAlias prefix
	openAliasPrefix: "xmr",

	// Currency name
	coinName: "Monero",

	// Payment URI Prefix
	coinUriPrefix: "monero:",

	// Prefix code for addresses
	addressPrefix: 18, // 18 => addresses start with "4"
	integratedAddressPrefix: 19,
	subaddressPrefix: 42,

	// Dust threshold in atomic units
	// 2*10^9 used for choosing outputs/change - we decompose all the way down if the receiver wants now regardless of threshold
	dustThreshold: new BigInt("2000000000"),

	// Maximum block number, used for tx unlock time
	maxBlockNumber: 500000000,

	// Average block time in seconds, used for unlock time estimation
	avgBlockTime: 60,
};
