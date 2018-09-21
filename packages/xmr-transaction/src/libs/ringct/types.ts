import { RangeSignature } from "./components/prove_range";
import { MGSig } from "./components/prove_ringct_mg";
import { CtKeyV, Commit } from "@xmr-core/xmr-crypto-utils";

export interface RCTSignatures {
	type: number;
	message: string;
	outPk: CtKeyV;
	p: {
		rangeSigs: RangeSignature[];
		MGs: MGSig[];
	};
	ecdhInfo: Commit[];
	txnFee: string;
	pseudoOuts: string[];
}
