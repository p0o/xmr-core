import { RangeSignature } from "./components/prove_range";
import { MGSig } from "./components/prove_ringct_mg";
import { Commit } from "xmr-types";
import { CtKeyV } from "xmr-device/types";

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
