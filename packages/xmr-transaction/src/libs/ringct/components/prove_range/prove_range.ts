import { BigInt } from "@xmr-core/biginteger";
import { genBorromean, verifyBorromean } from "./borromean";
import { RangeSignature } from "./types";
import {
	primitive_ops,
	constants,
	random_scalar,
} from "@xmr-core/xmr-crypto-utils";

import { d2b } from "@xmr-core/xmr-str-utils";

const {
	sc_add,

	ge_sub,
	ge_add,
	ge_scalarmult_base,
} = primitive_ops;

const { I, Z, identity, H2 } = constants;

//proveRange
//proveRange gives C, and mask such that \sumCi = C
//	 c.f. http://eprint.iacr.org/2015/1098 section 5.1
//	 and Ci is a commitment to either 0 or s^i, i=0,...,n
//	 thus this proves that "amount" is in [0, s^n] (we assume s to be 4) (2 for now with v2 txes)
//	 mask is a such that C = aG + bH, and b = amount

export function proveRange(amount: string | BigInt) {
	let C = I; //identity
	let mask = Z; //zero scalar

	// bitstring representation of amount
	const indices = d2b(amount);
	const Ci: string[] = [];

	const ai: string[] = [];
	const PM: string[][] = [[], []];

	//start at index and fill PM left and right -- PM[0] holds Ci
	for (let i = 0; i < 64; i++) {
		ai[i] = random_scalar();

		if (+indices[i] === 1) {
			// if b[i] === 1
			PM[1][i] = ge_scalarmult_base(ai[i]); //  yG
			PM[0][i] = ge_add(PM[1][i], H2[i]); // yG + H2[i]
		} else {
			PM[0][i] = ge_scalarmult_base(ai[i]); // yG
			PM[1][i] = ge_sub(PM[0][i], H2[i]); // yG - H2[i]
		}
		mask = sc_add(mask, ai[i]);
	}

	// copy commitments to sig and sum them to commitment
	for (let i = 0; i < 64; i++) {
		Ci[i] = PM[0][i];
		C = ge_add(C, Ci[i]);
	}

	const sig: RangeSignature = {
		Ci,
		bsig: genBorromean(ai, PM, indices), // create a borromean signature to avoid amount ambiguity
	};

	return { C, mask, sig };
}

//proveRange and verRange
//proveRange gives C, and mask such that \sumCi = C
//   c.f. http://eprint.iacr.org/2015/1098 section 5.1
//   and Ci is a commitment to either 0 or 2^i, i=0,...,63
//   thus this proves that "amount" is in [0, 2^64]
//   mask is a such that C = aG + bH, and b = amount
//verRange verifies that \sum Ci = C and that each Ci is a commitment to 0 or 2^i

export function verRange(C: string, as: RangeSignature) {
	try {
		let CiH = []; // len 64
		let asCi = []; // len 64
		let Ctmp = identity();
		for (let i = 0; i < 64; i++) {
			CiH[i] = ge_sub(as.Ci[i], H2[i]);
			asCi[i] = as.Ci[i];
			Ctmp = ge_add(Ctmp, as.Ci[i]);
		}
		const equalKeys = Ctmp === C;
		console.log(`[verRange] Equal keys? ${equalKeys} 
			C: ${C}
			Ctmp: ${Ctmp}`);
		if (!equalKeys) {
			return false;
		}

		if (!verifyBorromean(as.bsig, asCi, CiH)) {
			return false;
		}

		return true;
	} catch (e) {
		console.error(`[verRange]`, e);
		return false;
	}
}
