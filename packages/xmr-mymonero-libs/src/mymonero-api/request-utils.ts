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
