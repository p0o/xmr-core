import { getUnspentOuts } from "./get-unspent-outs";

jest.setTimeout(99999999);

describe("it should work", () => {
	it("get balance", done => {
		getUnspentOuts();

		setTimeout(() => {
			done();
		}, 99999999);
	});
});
