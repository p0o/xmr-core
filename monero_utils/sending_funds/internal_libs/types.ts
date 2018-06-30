import BigInt = require("cryptonote_utils/biginteger");
export const JSBigInt = BigInt.BigInteger;

export type JSBigInt = BigInt.BigInteger;
export type ViewSendKeys = {
	view: string;
	spend: string;
};
export type RawTarget = {
	address: string;
	amount: number;
};

export type ParsedTarget = {
	address: string;
	amount: JSBigInt;
};

export type Pid = string | null;
