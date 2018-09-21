import { skGen, DefaultDevice } from "@xmr-core/xmr-crypto-utils";
import {
	ge_scalarmult_base,
	ge_scalarmult,
} from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/primitive_ops";
import { identity } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/constants";
import { hashToPoint } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/hash_ops";
import {
	MLSAG_Gen,
	MLSAG_ver,
} from "@xmr-core/xmr-transaction/lib/libs/ringct/components/prove_ringct_mg";

it("MG_sigs", async () => {
	function skvGen(len: number) {
		const skVec: string[] = [];
		for (let i = 0; i < len; i++) {
			skVec.push(skGen());
		}
		return skVec;
	}
	//initializes a key matrix;
	//first parameter is rows,
	//second is columns
	function keyMInit(cols: number) {
		let rv: string[][] = [];
		for (let i = 0; i < cols; i++) {
			rv.push([]);
		}
		return rv;
	}
	let j = 0;

	//Tests for MG Sigs
	//#MG sig: true one
	let N = 3; // cols
	let R = 2; // rows

	let xm = keyMInit(N); // = [[None]*N] #just used to generate test public keys
	let sk = skvGen(R);

	// [
	// [pubkey1, commitment1],
	// [pubkey2, commitment2],
	// ...
	// [pubkeyn, commitmentn]]
	// // Gen creates a signature which proves that for some column in the keymatrix "pk"
	//  the signer knows a secret key for each row in that column
	let P = keyMInit(N); // = keyM[[None]*N] #stores the public keys;

	let ind = 2;
	let i = 0;

	for (j = 0; j < R; j++) {
		for (i = 0; i < N; i++) {
			xm[i][j] = skGen();
			P[i][j] = ge_scalarmult_base(xm[i][j]); // generate fake [pubkey, commit]
		}
	}

	for (j = 0; j < R; j++) {
		// our secret vector of [onetimesec, z]
		sk[j] = xm[ind][j];
	}
	const defaultHwDev = new DefaultDevice();
	let message = identity();
	let kimg = ge_scalarmult(hashToPoint(P[ind][0]), sk[0]);
	let rv = await MLSAG_Gen(message, P, sk, kimg, ind, defaultHwDev);
	let c = MLSAG_ver(message, P, rv, kimg);

	expect(c).toEqual(true);

	xm = keyMInit(N); // = [[None]*N] #just used to generate test public keys
	sk = skvGen(R);

	for (j = 0; j < R; j++) {
		for (i = 0; i < N; i++) {
			xm[i][j] = skGen();
			P[i][j] = ge_scalarmult_base(xm[i][j]); // generate fake [pubkey, commit]
		}
	}

	sk[1] = skGen(); //assume we don't know one of the private keys..
	kimg = ge_scalarmult(hashToPoint(P[ind][0]), sk[0]);
	rv = await MLSAG_Gen(message, P, sk, kimg, ind, defaultHwDev);
	c = MLSAG_ver(message, P, rv, kimg);

	expect(c).toEqual(false);
});
