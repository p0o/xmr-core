import { proveRange, verRange } from "./components/prove_range";
import {
	proveRctMG,
	verRctMG,
	verRctMGSimple,
} from "./components/prove_ringct_mg";
import { RCTSignatures } from "./types";
import { SecretCommitment, RingMember } from "../../types";
import { BigInt } from "@xmr-core/biginteger";
import {
	random_scalar,
	constants,
	primitive_ops,
	rctOps,
} from "@xmr-core/xmr-crypto-utils";
import { d2s, JSONPrettyPrint } from "@xmr-core/xmr-str-utils";
import { get_pre_mlsag_hash } from "./utils";
import { verBulletProof } from "./components/bullet_proofs";
import { HWDevice, CtKeyV } from "@xmr-core/xmr-crypto-utils";
import { DefaultDevice } from "@xmr-core/xmr-crypto-utils";

const {
	sc_add,
	sc_sub,
	ge_add,
	ge_double_scalarmult_base_vartime,
} = primitive_ops;
const { commit, scalarmultH } = rctOps;
const { I, Z, identity, H } = constants;

const RCTTypeFull = 1;
const RCTTypeSimple = 2;

//message is normal prefix hash
//inSk is vector of x,a
//kimg is vector of kimg
//destinations is vector of pubkeys
//inAmounts is vector of strings
//outAmounts is vector of strings
//mixRing is matrix of pubkey, commit (dest, mask)
//amountKeys is vector of scalars
//indices is vector
//txnFee is string, with its endian not swapped (e.g d2s is not called before passing it in as an argument)
//to this function

export async function genRct(
	message: string,
	inSk: SecretCommitment[],
	kimgs: string[],
	destinations: string[],
	inAmounts: (BigInt | string)[],
	outAmounts: (BigInt | string)[],
	mixRing: RingMember[][],
	amountKeys: string[],
	indices: number[],
	txnFee: string,
	hwdev: HWDevice,
) {
	JSONPrettyPrint(
		"genRct",
		{
			message,
			inSk,
			kimgs,
			destinations,
			inAmounts,
			outAmounts,
			mixRing,
			amountKeys,
			indices,
			txnFee,
		},
		"args",
	);
	if (outAmounts.length !== amountKeys.length) {
		throw Error("different number of amounts/amount_keys");
	}
	for (let i = 0; i < mixRing.length; i++) {
		if (mixRing[i].length <= indices[i]) {
			throw Error("bad mixRing/index size");
		}
	}
	if (mixRing.length !== inSk.length) {
		throw Error("mismatched mixRing/inSk");
	}

	if (indices.length !== inSk.length) {
		throw Error("mismatched indices/inSk");
	}

	const rv: RCTSignatures = {
		type: inSk.length === 1 ? RCTTypeFull : RCTTypeSimple,
		message,
		outPk: [],
		p: {
			rangeSigs: [],
			MGs: [],
		},
		ecdhInfo: [],
		txnFee,
		pseudoOuts: [],
	};

	let sumout = Z;

	const outSk: CtKeyV = [];
	let i;
	//compute range proofs, etc
	for (i = 0; i < outAmounts.length; i++) {
		const { C, mask, sig } = proveRange(outAmounts[i]);
		rv.outPk[i] = { dest: destinations[i], mask: C };
		outSk[i] = { mask, dest: "" };
		rv.p.rangeSigs[i] = sig;

		// the mask is the sum
		sumout = sc_add(sumout, outSk[i].mask);

		// encode the amount commitment for the receiver so that they can retrive blinding factor + amount later
		rv.ecdhInfo[i] = await hwdev.ecdhEncode(
			{ mask, amount: d2s(outAmounts[i]) }, //blinding factor y and amount b in C = yG + bH
			amountKeys[i],
		);
	}

	//simple
	if (rv.type === 2) {
		if (inAmounts.length !== inSk.length) {
			throw Error("mismatched inAmounts/inSk");
		}

		const ai: string[] = []; // blinding factor
		let sumpouts = Z;
		//create pseudoOuts
		for (i = 0; i < inAmounts.length - 1; i++) {
			// set each blinding factor to be random except for the last
			ai[i] = random_scalar();
			sumpouts = sc_add(sumpouts, ai[i]);
			rv.pseudoOuts[i] = commit(d2s(inAmounts[i]), ai[i]);
		}

		ai[i] = sc_sub(sumout, sumpouts);
		rv.pseudoOuts[i] = commit(d2s(inAmounts[i]), ai[i]);
		const pre_mlsag_hash = await get_pre_mlsag_hash(rv, mixRing, hwdev);
		for (i = 0; i < inAmounts.length; i++) {
			rv.p.MGs.push(
				await proveRctMG(
					pre_mlsag_hash,
					mixRing[i],
					inSk[i],
					kimgs[i],
					ai[i],
					rv.pseudoOuts[i],
					indices[i],
					hwdev,
				),
			);
		}
	} else {
		//get sum of input commitments to use in MLSAG
		let sumC = I;
		for (i = 0; i < rv.outPk.length; i++) {
			sumC = ge_add(sumC, rv.outPk[i].mask);
		}

		const txnfeeKey = scalarmultH(d2s(rv.txnFee));

		sumC = ge_add(sumC, txnfeeKey);
		const pre_mlsag_hash = await get_pre_mlsag_hash(rv, mixRing, hwdev);

		JSONPrettyPrint(
			"genRct",
			{
				txnfeeKey,
				sumC,
				pre_mlsag_hash,
			},
			"RCTTypeFull, pre rv.p.MGs.push",
		);

		rv.p.MGs.push(
			await proveRctMG(
				pre_mlsag_hash,
				mixRing[0],
				inSk[0],
				kimgs[0],
				sumout,
				sumC,
				indices[0],
				hwdev,
			),
		);
	}

	JSONPrettyPrint(
		"genRct",
		{
			rv,
		},
		"ret",
	);

	return rv;
}
const defaultHwDev = new DefaultDevice();

export async function verRct(
	rv: RCTSignatures,
	semantics: boolean,
	mixRing: RingMember[][],
	kimg: string,
) {
	if (rv.type === 0x03) {
		throw Error("Bulletproof validation not implemented");
	}

	// where RCTTypeFull is 0x01 and  RCTTypeFullBulletproof is 0x03
	if (rv.type !== 0x01 && rv.type !== 0x03) {
		throw Error("verRct called on non-full rctSig");
	}
	if (semantics) {
		// RCTTypeFullBulletproof checks not implemented
		// RCTTypeFull checks
		if (rv.outPk.length !== rv.p.rangeSigs.length) {
			throw Error("Mismatched sizes of outPk and rv.p.rangeSigs");
		}
		if (rv.outPk.length !== rv.ecdhInfo.length) {
			throw Error("Mismatched sizes of outPk and rv.ecdhInfo");
		}
		if (rv.p.MGs.length !== 1) {
			throw Error("full rctSig has not one MG");
		}
	} else {
		// semantics check is early, we don't have the MGs resolved yet
	}
	try {
		if (semantics) {
			const results = [];
			for (let i = 0; i < rv.outPk.length; i++) {
				// might want to parallelize this like its done in the c++ codebase
				// via some abstraction library to support browser + node
				if (rv.p.rangeSigs.length === 0) {
					results[i] = verBulletProof((rv.p as any).bulletproofs[i]);
				} else {
					// mask -> C if public
					results[i] = verRange(rv.outPk[i].mask, rv.p.rangeSigs[i]);
				}
			}

			for (let i = 0; i < rv.outPk.length; i++) {
				if (!results[i]) {
					console.error(
						"Range proof verification failed for output",
						i,
					);
					return false;
				}
			}
		} else {
			// compute txn fee
			const txnFeeKey = scalarmultH(d2s(rv.txnFee));
			const mgVerd = verRctMG(
				rv.p.MGs[0],
				mixRing,
				rv.outPk,
				txnFeeKey,
				await get_pre_mlsag_hash(rv, mixRing, defaultHwDev),
				kimg,
			);
			console.log("mg sig verified?", mgVerd);
			if (!mgVerd) {
				console.error("MG Signature verification failed");
				return false;
			}
		}
		return true;
	} catch (e) {
		console.error("Error in verRct: ", e);
		return false;
	}
}

//ver RingCT simple
//assumes only post-rct style inputs (at least for max anonymity)
export async function verRctSimple(
	rv: RCTSignatures,
	semantics: boolean,
	mixRing: RingMember[][],
	kimgs: string[],
) {
	try {
		if (rv.type === 0x04) {
			throw Error("Simple Bulletproof validation not implemented");
		}

		if (rv.type !== 0x02 && rv.type !== 0x04) {
			throw Error("verRctSimple called on non simple rctSig");
		}

		if (semantics) {
			if (rv.type == 0x04) {
				throw Error("Simple Bulletproof validation not implemented");
			} else {
				if (rv.outPk.length !== rv.p.rangeSigs.length) {
					throw Error("Mismatched sizes of outPk and rv.p.rangeSigs");
				}
				if (rv.pseudoOuts.length !== rv.p.MGs.length) {
					throw Error(
						"Mismatched sizes of rv.pseudoOuts and rv.p.MGs",
					);
				}
				// originally the check is rv.p.pseudoOuts.length, but this'll throw
				// until p.pseudoOuts is added as a property to the rv object
				if ((rv.p as any).pseudoOuts) {
					throw Error("rv.p.pseudoOuts must be empty");
				}
			}
		} else {
			if (rv.type === 0x04) {
				throw Error("Simple Bulletproof validation not implemented");
			} else {
				// semantics check is early, and mixRing/MGs aren't resolved yet
				if (rv.pseudoOuts.length !== mixRing.length) {
					throw Error(
						"Mismatched sizes of rv.pseudoOuts and mixRing",
					);
				}
			}
		}

		// if bulletproof, then use rv.p.pseudoOuts, otherwise use rv.pseudoOuts
		const pseudoOuts =
			(rv.type as number) === 0x04
				? (rv.p as any).pseudoOuts
				: rv.pseudoOuts;

		if (semantics) {
			let sumOutpks = identity();
			for (let i = 0; i < rv.outPk.length; i++) {
				sumOutpks = ge_add(sumOutpks, rv.outPk[i].mask); // add all of the output commitments
			}

			const txnFeeKey = scalarmultH(d2s(rv.txnFee));
			sumOutpks = ge_add(txnFeeKey, sumOutpks); // add txnfeekey

			let sumPseudoOuts = identity();
			for (let i = 0; i < pseudoOuts.length; i++) {
				sumPseudoOuts = ge_add(sumPseudoOuts, pseudoOuts[i]); // sum up all of the pseudoOuts
			}

			if (sumOutpks !== sumPseudoOuts) {
				console.error("Sum check failed");
				return false;
			}

			const results = [];
			for (let i = 0; i < rv.outPk.length; i++) {
				// might want to parallelize this like its done in the c++ codebase
				// via some abstraction library to support browser + node
				if (rv.p.rangeSigs.length === 0) {
					results[i] = verBulletProof((rv.p as any).bulletproofs[i]);
				} else {
					// mask -> C if public
					results[i] = verRange(rv.outPk[i].mask, rv.p.rangeSigs[i]);
				}
			}

			for (let i = 0; i < results.length; i++) {
				if (!results[i]) {
					console.error(
						"Range proof verification failed for output",
						i,
					);
					return false;
				}
			}
		} else {
			const message = await get_pre_mlsag_hash(rv, mixRing, defaultHwDev);
			const results = [];
			for (let i = 0; i < mixRing.length; i++) {
				results[i] = verRctMGSimple(
					message,
					rv.p.MGs[i],
					mixRing[i],
					pseudoOuts[i],
					kimgs[i],
				);
			}

			for (let i = 0; i < results.length; i++) {
				if (!results[i]) {
					console.error(
						"Range proof verification failed for output",
						i,
					);
					return false;
				}
			}
		}

		return true;
	} catch (error) {
		console.log("[verRctSimple]", error);
		return false;
	}
}

//decodeRct: (c.f. http://eprint.iacr.org/2015/1098 section 5.1.1)
//   uses the attached ecdh info to find the amounts represented by each output commitment
//   must know the destination private key to find the correct amount, else will return a random number

export async function decodeRct(
	rv: RCTSignatures,
	sk: string,
	i: number,
	hwdev: HWDevice,
) {
	// where RCTTypeFull is 0x01 and  RCTTypeFullBulletproof is 0x03
	if (rv.type !== 0x01 && rv.type !== 0x03) {
		throw Error("verRct called on non-full rctSig");
	}
	if (i >= rv.ecdhInfo.length) {
		throw Error("Bad index");
	}
	if (rv.outPk.length !== rv.ecdhInfo.length) {
		throw Error("Mismatched sizes of rv.outPk and rv.ecdhInfo");
	}

	// mask amount and mask
	const ecdh_info = rv.ecdhInfo[i];
	const { mask, amount } = await hwdev.ecdhDecode(ecdh_info, sk);

	const C = rv.outPk[i].mask;
	const Ctmp = ge_double_scalarmult_base_vartime(amount, H, mask);

	console.log("[decodeRct]", C, Ctmp);
	if (C !== Ctmp) {
		throw Error(
			"warning, amount decoded incorrectly, will be unable to spend",
		);
	}
	return { amount, mask };
}

export async function decodeRctSimple(
	rv: RCTSignatures,
	sk: string,
	i: number,
	hwdev: HWDevice,
) {
	if (rv.type !== 0x02 && rv.type !== 0x04) {
		throw Error("verRct called on full rctSig");
	}
	if (i >= rv.ecdhInfo.length) {
		throw Error("Bad index");
	}
	if (rv.outPk.length !== rv.ecdhInfo.length) {
		throw Error("Mismatched sizes of rv.outPk and rv.ecdhInfo");
	}

	// mask amount and mask
	const ecdh_info = rv.ecdhInfo[i];
	const { mask, amount } = await hwdev.ecdhDecode(ecdh_info, sk);

	const C = rv.outPk[i].mask;
	const Ctmp = ge_double_scalarmult_base_vartime(amount, H, mask);

	console.log("[decodeRctSimple]", C, Ctmp);
	if (C !== Ctmp) {
		throw Error(
			"warning, amount decoded incorrectly, will be unable to spend",
		);
	}
	return { amount, mask };
}
