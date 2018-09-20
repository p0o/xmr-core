import { BigInt } from "biginteger";
import { ctskpkGen, populateFromBlockchain } from "./test_utils";
import { SecretCommitment, RingMember } from "@xmr-core/xmr-transaction";
import { hash_to_scalar } from "@xmr-core/xmr-crypto-utils/hash_ops";
import { Z } from "@xmr-core/xmr-crypto-utils/constants";
import { generate_key_image } from "@xmr-core/xmr-crypto-utils/key_image";
import {
	genRct,
	verRct,
	decodeRct,
} from "@xmr-core/xmr-transaction/libs/ringct";
import { random_keypair } from "@xmr-core/xmr-crypto-utils";
import { DefaultDevice } from "@xmr-core/xmr-crypto-utils/device-default";

// Copyright (c) 2014-2018, MyMonero.com
//
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification, are
// permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this list of
//	conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice, this list
//	of conditions and the following disclaimer in the documentation and/or other
//	materials provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its contributors may be
//	used to endorse or promote products derived from this software without specific
//	prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL
// THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
// STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
// THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

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
