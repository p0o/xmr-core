import { getBalance } from "./get-balance";
jest.setTimeout(99999999);

describe("it should work", () => {
	it("get balance", done => {
		getBalance();

		setTimeout(() => {
			done();
		}, 99999999);
	});
});
