import monero_utils from "monero_utils/monero_cryptonote_utils_instance";
import { JSBigInt, ParsedTarget } from "./types";

export namespace Log {
	export namespace Amount {
		export function beforeFee(feelessTotal: JSBigInt, isSweeping: boolean) {
			const feeless_total = isSweeping
				? "all"
				: monero_utils.formatMoney(feelessTotal);
			console.log(`💬  Total to send, before fee: ${feeless_total}`);
		}

		export function change(changeAmount: JSBigInt) {
			console.log("changeAmount", changeAmount);
		}

		export function changeAmountDivRem(amt: [JSBigInt, JSBigInt]) {
			console.log("💬  changeAmountDivRem", amt);
		}

		export function toSelf(changeAmount: JSBigInt, selfAddress: string) {
			console.log(
				"Sending change of " +
					monero_utils.formatMoneySymbol(changeAmount) +
					" to " +
					selfAddress,
			);
		}
	}

	export namespace Fee {
		export function dynPerKB(dynFeePerKB: JSBigInt) {
			console.log(
				"Received dynamic per kb fee",
				monero_utils.formatMoneySymbol(dynFeePerKB),
			);
		}
		export function basedOnInputs(newNeededFee: JSBigInt, usingOuts) {
			console.log(
				"New fee: " +
					monero_utils.formatMoneySymbol(newNeededFee) +
					" for " +
					usingOuts.length +
					" inputs",
			);
		}
		export function belowDustThreshold(changeDivDustRemainder: JSBigInt) {
			console.log(
				"💬  Miners will add change of " +
					monero_utils.formatMoneyFullSymbol(changeDivDustRemainder) +
					" to transaction fee (below dust threshold)",
			);
		}
	}

	export namespace Balance {
		export function requiredPreRCT(
			totalAmount: JSBigInt,
			isSweeping: boolean,
		) {
			if (isSweeping) {
				console.log("Balance required: all");
			} else {
				console.log(
					"Balance required: " +
						monero_utils.formatMoneySymbol(totalAmount),
				);
			}
		}

		export function requiredPostRct(totalAmount: JSBigInt) {
			console.log(
				"~ Balance required: " +
					monero_utils.formatMoneySymbol(totalAmount),
			);
		}
	}

	export namespace Output {
		export function uniformity(fakeAddress: string) {
			console.log(
				"Sending 0 XMR to a fake address to keep tx uniform (no change exists): " +
					fakeAddress,
			);
		}

		export function display(out) {
			console.log(
				"Using output: " +
					monero_utils.formatMoney(out.amount) +
					" - " +
					JSON.stringify(out),
			);
		}
	}

	export namespace Target {
		export function display(fundTargets: ParsedTarget[]) {
			console.log("fundTransferDescriptions so far", fundTargets);
		}

		export function fullDisplay(fundTargets: ParsedTarget[]) {
			console.log("Destinations: ");
			monero_utils.printDsts(fundTargets);
		}

		export function displayDecomposed(splitDestinations) {
			console.log("Decomposed destinations:");
			monero_utils.printDsts(splitDestinations);
		}

		export function viewKey(viewKey: string) {
			console.log("got target address's view key", viewKey);
		}
	}
}
