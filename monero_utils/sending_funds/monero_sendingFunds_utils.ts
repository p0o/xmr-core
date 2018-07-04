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
//

import monero_config from "monero_utils/monero_config";
import monero_utils from "monero_utils/monero_cryptonote_utils_instance";
import { NetType } from "cryptonote_utils/nettype";
import {
	RawTarget,
	JSBigInt,
	Pid,
	ViewSendKeys,
	ParsedTarget,
} from "./internal_libs/types";
import {
	calculateFee,
	multiplyFeePriority,
	calculateFeeKb,
} from "./internal_libs/fee_utils";
import { minMixin } from "./mixin_utils";
import { Status, sendFundStatus } from "./status_update_constants";
import { ERR } from "./internal_libs/errors";
import { Log } from "./internal_libs/logger";
import { popRandElement } from "./internal_libs/arr_utils";
import { selectOutputsAndAmountForMixin } from "./internal_libs/output_selection";
import { parseTargets } from "./internal_libs/parse_target";
import { checkAddressAndPidValidity } from "./internal_libs/pid_utils";
import { WrappedNodeApi } from "./async_node_api";

export function estimatedTransactionNetworkFee(
	nonZeroMixin: number,
	feePerKB: JSBigInt,
	simplePriority: number,
) {
	const numOfInputs = 2; // this might change -- might select inputs
	const numOfOutputs =
		1 /*dest*/ + 1 /*change*/ + 0; /*no mymonero fee presently*/
	// TODO: update est tx size for bulletproofs
	// TODO: normalize est tx size fn naming
	const estimatedTxSize = monero_utils.estimateRctSize(
		numOfInputs,
		nonZeroMixin,
		numOfOutputs,
	);
	const estFee = calculateFee(
		feePerKB,
		estimatedTxSize,
		multiplyFeePriority(simplePriority),
	);

	return estFee;
}

type SendFundsRet = {
	targetAddress: string;
	sentAmount: number;
	pid: Pid;
	txHash: string;
	txFee: JSBigInt;
};

export async function SendFunds(
	targetAddress: string, // currency-ready wallet address, but not an OpenAlias address (resolve before calling)
	nettype: NetType,
	amountorZeroWhenSweep: number, // n value will be ignored for sweep
	isSweeping: boolean, // send true to sweep - amountorZeroWhenSweep will be ignored
	senderPublicAddress: string,
	senderPrivateKeys: ViewSendKeys,
	senderPublicKeys: ViewSendKeys,
	nodeAPI: any, // TODO: possibly factor this dependency
	pid: Pid,
	mixin: number,
	simplePriority: number,
	updateStatus: (status: Status) => void,
): Promise<SendFundsRet> {
	const api = new WrappedNodeApi(nodeAPI);
	const isRingCT = true;

	if (mixin < minMixin()) {
		throw ERR.RING.INSUFF;
	}
	//
	// parse & normalize the target descriptions by mapping them to Monero addresses & amounts
	const targetAmount = isSweeping ? 0 : amountorZeroWhenSweep;
	const target: RawTarget = {
		address: targetAddress,
		amount: targetAmount,
	};
	const [singleTarget] = parseTargets(
		[target], // requires a list of descriptions - but SendFunds was
		// not written with multiple target support as MyMonero does not yet support it
		nettype,
	);

	if (!singleTarget) {
		throw ERR.DEST.INVAL;
	}

	const { address, amount } = singleTarget;
	const feelessTotal = new JSBigInt(amount);

	Log.Amount.beforeFee(feelessTotal, isSweeping);

	if (!isSweeping && feelessTotal.compare(0) <= 0) {
		throw ERR.AMT.INSUFF;
	}

	const { encryptPid, pid: _pid } = checkAddressAndPidValidity(
		address,
		nettype,
		pid,
	);

	updateStatus(sendFundStatus.fetchingLatestBalance);

	const { dynamicFeePerKB, unusedOuts } = await api.unspentOuts(
		senderPublicAddress,
		senderPrivateKeys,
		senderPublicKeys,
		mixin,
		isSweeping,
	);

	// status: constructing transaction…
	const feePerKB = dynamicFeePerKB;
	// Transaction will need at least 1KB fee (or 13KB for RingCT)
	const minNetworkTxSizeKb = /*isRingCT ? */ 13; /* : 1*/
	const _estMinNetworkFee = calculateFeeKb(
		feePerKB,
		minNetworkTxSizeKb,
		multiplyFeePriority(simplePriority),
	);

	// now we're going to try using this minimum fee but the function will be called again
	// if we find after constructing the whole tx that it is larger in kb than
	// the minimum fee we're attempting to send it off with
	return await _attempt_to_constructFundTransferListAndSendFunds_findingLowestNetworkFee(
		address,
		feelessTotal,
		_pid,
		encryptPid,
		unusedOuts,
		feePerKB, // obtained from server, so passed in
		_estMinNetworkFee,
	);

	async function _attempt_to_constructFundTransferListAndSendFunds_findingLowestNetworkFee(
		_targetAddress: string,
		_feelessTotal: JSBigInt,
		_pid: Pid,
		_encryptPid: boolean,
		_unusedOuts,
		_feePerKB: JSBigInt,
		_estMinNetworkFee: JSBigInt,
	) {
		// Now we need to establish some values for balance validation and to construct the transaction
		updateStatus(sendFundStatus.calculatingFee);

		let estMinNetworkFee = _estMinNetworkFee; // we may change this if isRingCT
		// const hostingService_chargeAmount = hostedMoneroAPIClient.HostingServiceChargeFor_transactionWithNetworkFee(attemptAt_network_minimumFee)
		let totalAmount: JSBigInt;
		if (isSweeping) {
			totalAmount = new JSBigInt("18450000000000000000"); //~uint64 max
		} else {
			totalAmount = _feelessTotal.add(
				estMinNetworkFee,
			); /*.add(hostingService_chargeAmount) NOTE service fee removed for now */
		}

		Log.Balance.requiredPreRCT(totalAmount, isSweeping);

		const {
			remainingUnusedOuts, // this is a copy of the pre-mutation usingOuts
			usingOuts,
			usingOutsAmount,
		} = selectOutputsAndAmountForMixin(
			totalAmount,
			_unusedOuts,
			isRingCT,
			isSweeping,
		);
		// v-- now if RingCT compute fee as closely as possible before hand

		if (/*usingOuts.length > 1 &&*/ isRingCT) {
			let newNeededFee = calculateFee(
				_feePerKB,
				monero_utils.estimateRctSize(usingOuts.length, mixin, 2),
				multiplyFeePriority(simplePriority),
			);

			// if newNeededFee < neededFee, use neededFee instead
			//(should only happen on the 2nd or later times through(due to estimated fee being too low))
			if (newNeededFee.compare(estMinNetworkFee) < 0) {
				newNeededFee = estMinNetworkFee;
			}
			if (isSweeping) {
				/* 
				// When/if sending to multiple destinations supported, uncomment and port this:					
				if (dsts.length !== 1) {
					deferred.reject("Sweeping to multiple accounts is not allowed");
					return;
				}
				*/

				// feeless total is equivalent to all outputs (since its a sweeping tx)
				// subtracted from the newNeededFee  (either from min tx cost or calculated cost based on outputs)
				_feelessTotal = usingOutsAmount.subtract(newNeededFee);

				// if the feeless total is less than 0 (so sum of all outputs is still less than network fee)
				// then reject tx
				if (_feelessTotal.compare(0) < 1) {
					throw ERR.BAL.insuff(usingOutsAmount, newNeededFee);
				}

				// otherwise make the total amount the feeless total + the new fee
				totalAmount = _feelessTotal.add(newNeededFee);
			} else {
				// non sweeting rct tx

				// make the current total amount equivalent to the feeless total and the new needed fee
				totalAmount = _feelessTotal.add(newNeededFee);

				// add outputs 1 at a time till we either have them all or can meet the fee

				// this case can happen when the fee calculated via outs size
				// is greater than the minimum tx fee size,
				// requiring a higher fee, so more outputs (if available)
				// need to be selected to fufill the difference
				while (
					usingOutsAmount.compare(totalAmount) < 0 &&
					remainingUnusedOuts.length > 0
				) {
					const out = popRandElement(remainingUnusedOuts);

					Log.Output.display(out);

					// and recalculate invalidated values
					newNeededFee = calculateFee(
						_feePerKB,
						monero_utils.estimateRctSize(
							usingOuts.length,
							mixin,
							2,
						),
						multiplyFeePriority(simplePriority),
					);
					totalAmount = _feelessTotal.add(newNeededFee);
				}
			}

			Log.Fee.basedOnInputs(newNeededFee, usingOuts);

			// not really a minNetworkFee now
			// its max {minNetworkFee, feeCalculatedViaOuts}
			estMinNetworkFee = newNeededFee;
		}

		Log.Balance.requiredPostRct(totalAmount);

		// Now we can validate available balance with usingOutsAmount (TODO? maybe this check can be done before selecting outputs?)

		const outsCmpToTotalAmounts = usingOutsAmount.compare(totalAmount);
		const outsLessThanTotal = outsCmpToTotalAmounts < 0;
		const outsGreaterThanTotal = outsCmpToTotalAmounts > 0;
		const outsEqualToTotal = outsCmpToTotalAmounts === 0;

		// what follows is comparision of the sum of outs amounts
		// vs the total amount actually needed
		// while also building up a list of addresses to send to
		// along with the amounts

		if (outsLessThanTotal) {
			throw ERR.BAL.insuff(usingOutsAmount, totalAmount);
		}

		// Now we can put together the list of fund transfers we need to perform
		// not including the tx fee
		// since that is included in the tx in its own field
		const fundTargets: ParsedTarget[] = []; // to build…
		// I. the actual transaction the user is asking to do
		fundTargets.push({
			address: _targetAddress,
			amount: _feelessTotal,
		});

		// the fee that the hosting provider charges
		// NOTE: The fee has been removed for RCT until a later date
		// fundTransferDescriptions.push({
		//			 address: hostedMoneroAPIClient.HostingServiceFeeDepositAddress(),
		//			 amount: hostingService_chargeAmount
		// })

		// some amount of the total outputs will likely need to be returned to the user as "change":
		if (outsGreaterThanTotal) {
			if (isSweeping) {
				throw ERR.SWEEP.TOTAL_NEQ_OUTS;
			}
			// where the change amount is whats left after sending to other addresses + fee
			const changeAmount = usingOutsAmount.subtract(totalAmount);

			Log.Amount.change(changeAmount);

			if (isRingCT) {
				// for RCT we don't presently care about dustiness so add entire change amount
				Log.Amount.toSelf(changeAmount, senderPublicAddress);

				fundTargets.push({
					address: senderPublicAddress,
					amount: changeAmount,
				});
			} else {
				// pre-ringct
				// do not give ourselves change < dust threshold
				const [
					changeDivDustQuotient,
					changeDivDustRemainder,
				] = changeAmount.divRem(monero_config.dustThreshold);

				Log.Amount.changeAmountDivRem([
					changeDivDustQuotient,
					changeDivDustRemainder,
				]);

				if (!changeDivDustRemainder.isZero()) {
					// miners will add dusty change to fee
					Log.Fee.belowDustThreshold(changeDivDustRemainder);
				}
				if (!changeDivDustQuotient.isZero()) {
					// send non-dusty change to our address
					const usableChange = changeDivDustQuotient.multiply(
						monero_config.dustThreshold,
					);

					Log.Amount.toSelf(usableChange, senderPublicAddress);

					fundTargets.push({
						address: senderPublicAddress,
						amount: usableChange,
					});
				}
			}
		} else if (outsEqualToTotal) {
			// if outputs are equivalent to the total amount
			// this should always fire when sweeping
			// since we want to spend all outputs anyway
			if (isRingCT) {
				// then create random destination to keep 2 outputs always in case of 0 change
				// so we dont create 1 output (outlier)
				const fakeAddress = monero_utils.create_address(
					monero_utils.random_scalar(),
					nettype,
				).public_addr;

				Log.Output.uniformity(fakeAddress);

				fundTargets.push({
					address: fakeAddress,
					amount: JSBigInt.ZERO,
				});
			}
		}

		Log.Target.display(fundTargets);

		// check for invalid mixin level
		if (mixin < 0 || isNaN(mixin)) {
			throw ERR.MIXIN.INVAL;
		}

		// if we want to have mixin for anonyminity
		if (mixin > 0) {
			// first, grab RandomOuts, then enter __createTx
			updateStatus(sendFundStatus.fetchingDecoyOutputs);

			// grab random outputs to make a ring signature with
			const { amount_outs } = await api.randomOuts(usingOuts, mixin);

			return await _createTxAndAttemptToSend(amount_outs);
		} else {
			// mixin === 0: -- PSNOTE: is that even allowed?
			return await _createTxAndAttemptToSend();
		}
		async function _createTxAndAttemptToSend(
			mixOuts?: any,
		): Promise<SendFundsRet> {
			updateStatus(sendFundStatus.constructingTransaction);
			let signedTx;
			try {
				Log.Target.fullDisplay(fundTargets);

				let targetViewKey; // need to get viewkey for encrypting here, because of splitting and sorting
				if (_encryptPid) {
					targetViewKey = monero_utils.decode_address(
						_targetAddress,
						nettype,
					).view;

					Log.Target.viewKey(targetViewKey);
				}
				const splitDestinations = monero_utils.decompose_tx_destinations(
					fundTargets,
					isRingCT,
				);

				Log.Target.displayDecomposed(splitDestinations);

				signedTx = monero_utils.create_transaction(
					senderPublicKeys,
					senderPrivateKeys,
					splitDestinations,
					usingOuts,
					mixOuts,
					mixin,
					estMinNetworkFee,
					_pid,
					_encryptPid,
					targetViewKey,
					0,
					isRingCT,
					nettype,
				);
			} catch (e) {
				throw ERR.TX.failure(e);
			}

			Log.Transaction.signed(signedTx);

			let serializedSignedTx;
			let txHash;
			// pre rct
			if (signedTx.version === 1) {
				serializedSignedTx = monero_utils.serialize_tx(signedTx);
				txHash = monero_utils.cn_fast_hash(serializedSignedTx);
			} else {
				// rct
				const raw_tx_and_hash = monero_utils.serialize_rct_tx_with_hash(
					signedTx,
				);
				serializedSignedTx = raw_tx_and_hash.raw;
				txHash = raw_tx_and_hash.hash;
			}

			Log.Transaction.serializedAndHash(serializedSignedTx, txHash);

			// work out per-kb fee for transaction and verify that it's enough
			const txBlobBytes = serializedSignedTx.length / 2;
			let numOfKB = Math.floor(txBlobBytes / 1024);
			if (txBlobBytes % 1024) {
				numOfKB++;
			}

			Log.Fee.txKB(txBlobBytes, numOfKB, estMinNetworkFee);

			const feeActuallyNeededByNetwork = calculateFeeKb(
				_feePerKB,
				numOfKB,
				multiplyFeePriority(simplePriority),
			);
			// if we need a higher fee
			if (feeActuallyNeededByNetwork.compare(estMinNetworkFee) > 0) {
				Log.Fee.estLowerThanReal(
					estMinNetworkFee,
					feeActuallyNeededByNetwork,
				);

				// this will update status back to .calculatingFee
				return await _attempt_to_constructFundTransferListAndSendFunds_findingLowestNetworkFee(
					_targetAddress,
					_feelessTotal,
					_pid,
					_encryptPid,
					_unusedOuts,
					_feePerKB,
					feeActuallyNeededByNetwork, // we are re-entering this codepath after changing this feeActuallyNeededByNetwork
				);
			}

			// generated with correct per-kb fee
			const finalNetworkFee = estMinNetworkFee; // just to make things clear

			Log.Fee.successfulTx(finalNetworkFee);
			updateStatus(sendFundStatus.submittingTransaction);

			await api.submitSerializedSignedTransaction(
				senderPublicAddress,
				senderPrivateKeys,
				serializedSignedTx,
			);
			const txFee = finalNetworkFee; /*.add(hostingService_chargeAmount) NOTE: Service charge removed to reduce bloat for now */
			const ret: SendFundsRet = {
				pid: _pid,
				sentAmount: isSweeping
					? parseFloat(monero_utils.formatMoneyFull(_feelessTotal))
					: targetAmount,
				targetAddress: _targetAddress,
				txFee,
				txHash,
			};
			return ret;
		}
	}
}
