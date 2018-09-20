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

import axios from "axios";

export function withUserAgentParams<T>(params: T) {
	// setting these on params instead of as header field User-Agent so as to retain all info found in User-Agent
	// such as platform… and these are set so server has option to control delivery
	return Object.assign(params, {
		app_name: "@xmr-core/mymonero-api", // originally MyMonero
		app_version: "0.0.1", //originally 0.0.1
	});
}

type Json = {
	[key: string]:
		| null
		| undefined
		| number
		| string
		| boolean
		| Json
		| (null | undefined | number | string | boolean | Json)[];
};

/**
 *
 *
 * @export
 * @param {string} hostName e.g api.mymonero.com
 * @param {string} endPoint e.g login
 * @param {Json} payload
 * @returns
 */
export async function makeRequest(
	hostName: string,
	endPoint: string,
	payload: Json,
) {
	const url = `https://${hostName}/${endPoint}`;

	const res = await axios.post(url, payload, {
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
	});

	return res.data;
}
