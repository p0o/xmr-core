import { ctskpkGen, populateFromBlockchainSimple } from "./test_utils";

import { BigInt } from "@xmr-core/biginteger";

import { hash_to_scalar } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/hash_ops";

import { Z } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/constants";

import {
	random_keypair,
	random_scalar,
	DefaultDevice,
} from "@xmr-core/xmr-crypto-utils";

import { generate_key_image } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/key_image";

import {
	genRct,
	verRctSimple,
	decodeRctSimple,
} from "@xmr-core/xmr-transaction";

it("should test ringct simple transactions", async () => {
	//Ring CT Stuff
	//ct range proofs
	// ctkey vectors
	let inSk = [],
		inPk = [],
		outamounts = [], // output amounts
		inamounts = [], // input amounts
		amount_keys = [],
		destinations = [];
	//add fake input 3000
	//inSk is secret data
	//inPk is public data
	{
		let [sctmp, pctmp] = ctskpkGen(3000);
		inSk.push(sctmp);
		inPk.push(pctmp);
		inamounts.push(new BigInt(3000));
	}

	//add fake input 3000
	//inSk is secret data
	//inPk is public data
	{
		let [sctmp, pctmp] = ctskpkGen(3000);
		inSk.push(sctmp);
		inPk.push(pctmp);
		inamounts.push(new BigInt(3000));
	}

	outamounts.push(new BigInt(5000));
	amount_keys.push(hash_to_scalar(Z));
	destinations.push(random_keypair().pub);

	outamounts.push(new BigInt(999));
	amount_keys.push(hash_to_scalar(Z));
	destinations.push(random_keypair().pub);

	const message = random_scalar();
	const txnFee = "1";

	// generate mixin and indices
	let mixRings = [];
	let indices = [];
	const mixin = 3;
	for (let i = 0; i < inPk.length; i++) {
		const { mixRing, index } = populateFromBlockchainSimple(inPk[i], mixin);
		mixRings.push(mixRing);
		indices.push(index);
	}

	// generate kimg
	const kimg = [
		generate_key_image(inPk[0].dest, inSk[0].x),
		generate_key_image(inPk[1].dest, inSk[1].x),
	];

	const defaultHwDev = new DefaultDevice();

	const s = await genRct(
		message,
		inSk,
		kimg,
		destinations,
		inamounts,
		outamounts,
		mixRings,
		amount_keys,
		indices,
		txnFee,
		defaultHwDev,
	);

	expect(await verRctSimple(s, true, mixRings, kimg)).toEqual(true);
	expect(await verRctSimple(s, false, mixRings, kimg)).toEqual(true);

	await decodeRctSimple(s, amount_keys[1], 1, defaultHwDev);
});
