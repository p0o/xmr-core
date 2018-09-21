import { BigInt } from "biginteger";
import { ctskpkGen, populateFromBlockchain } from "./test_utils";
import {
	SecretCommitment,
	RingMember,
	genRct,
	verRct,
	decodeRct,
} from "@xmr-core/xmr-transaction";
import { hash_to_scalar } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/hash_ops";
import { Z } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/constants";
import { random_keypair, DefaultDevice } from "@xmr-core/xmr-crypto-utils";
import { generate_key_image } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/key_image";

it("range_proofs", async () => {
	//Ring CT Stuff
	//ct range proofs
	// ctkey vectors
	let inSk: SecretCommitment[] = [],
		inPk: RingMember[] = [];
	const destinations = [];

	// ctkeys
	// we test only a single input here since the current impl of
	// MLSAG_gen of type full only supports single inputs
	{
		let [sctmp, pctmp] = ctskpkGen(6001);
		console.log(sctmp, pctmp);
		inSk.push(sctmp);
		inPk.push(pctmp);
		console.log("inPk", inPk);
	}

	// xmr amount vector
	let amounts = [];
	// key vector
	let amount_keys = [];

	amounts.push(new BigInt(1000));
	amount_keys.push(hash_to_scalar(Z));
	destinations.push(random_keypair().pub);

	amounts.push(new BigInt(4000));
	amount_keys.push(hash_to_scalar(Z));
	destinations.push(random_keypair().pub);

	amounts.push(new BigInt(1000));
	amount_keys.push(hash_to_scalar(Z));
	destinations.push(random_keypair().pub);

	//compute rct data with mixin 500
	const { index, mixRing } = populateFromBlockchain(inPk, 2);

	// generate kimg
	const kimg = [generate_key_image(inPk[0].dest, inSk[0].x)];

	// add fee of 1 NOTE: fee is passed in with its endian not swapped, hence no usage of d2s
	const fee = "1";
	const defaultHwDev = new DefaultDevice();

	let s = await genRct(
		Z,
		inSk,
		kimg,
		destinations,
		[],
		amounts,
		mixRing,
		amount_keys,
		[index],
		fee,
		defaultHwDev,
	);

	expect(await verRct(s, true, mixRing, kimg[0])).toEqual(true);
	expect(await verRct(s, false, mixRing, kimg[0])).toEqual(true);

	//decode received amount
	await decodeRct(s, amount_keys[1], 1, defaultHwDev);

	// Ring CT with failing MG sig part should not verify!
	// Since sum of inputs != outputs

	amounts[1] = new BigInt(4501);

	s = await genRct(
		Z,
		inSk,
		kimg,
		destinations,
		[],
		amounts,
		mixRing,
		amount_keys,
		[index],
		fee,
		defaultHwDev,
	);

	expect(await verRct(s, true, mixRing, kimg[0])).toEqual(true);
	expect(await verRct(s, false, mixRing, kimg[0])).toEqual(false);

	//decode received amount
	await decodeRct(s, amount_keys[1], 1, defaultHwDev);
});
