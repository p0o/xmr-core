import {
	genBorromean,
	verifyBorromean,
} from "xmr-transaction/src/libs/ringct/components/prove_range";

import { generate_parameters } from "./test_parameters";
const { indi, P1v, P2v, xv } = generate_parameters();

it("borromean_4", () => {
	// #false one
	const bb = genBorromean(xv, [P2v, P1v], indi); /*?.*/
	const valid = verifyBorromean(bb, P1v, P2v); /*?.*/
	expect(valid).toBe(false);
});
