import { JSBigInt, Pid, ParsedTarget, ViewSendKeys } from "./types";
import { sendFundStatus, Status } from "../status_update_constants";
import { selectOutputsAndAmountForMixin } from "./output_selection";
import { multiplyFeePriority, calculateFeeKb } from "./fee_utils";
import { ERR } from "./errors";
import { Log } from "./logger";
import { SendFundsRet } from "../monero_sendingFunds_utils";
import monero_config from "monero_utils/monero_config";
import monero_utils from "monero_utils/monero_cryptonote_utils_instance";
import { WrappedNodeApi } from "../internal_libs/async_node_api";
import { NetType } from "cryptonote_utils/nettype";
import { constructTx, totalAmtAndEstFee } from "./tx_utils";
import { getBaseTotalAmount } from "./amt_utils";

type Params = {
	senderAddress: string;
	senderPublicKeys: ViewSendKeys;
	senderPrivateKeys: ViewSendKeys;

	targetAddress: string;
	targetAmount: number;

	pid: Pid;
	encryptPid: boolean;

	mixin: number;
	unusedOuts;

	simplePriority: number;
	feelessTotal: JSBigInt;
	feePerKB: JSBigInt; // obtained from server, so passed in
	networkFee: JSBigInt;

	isSweeping: boolean;
	isRingCT: boolean;

	updateStatus: (status: Status) => void;
	api: WrappedNodeApi;
	nettype: NetType;
};

export async function _attempt_to_constructFundTransferListAndSendFunds_findingLowestNetworkFee(
	params: Params,
) {
	const {
		senderAddress,
		senderPublicKeys,
		senderPrivateKeys,

		targetAddress,
		targetAmount,

		pid,
		encryptPid,

		mixin,
		unusedOuts,

		simplePriority,
		feelessTotal,
		feePerKB, // obtained from server, so passed in
		networkFee,

		isRingCT,
		isSweeping,

		updateStatus,
		api,
		nettype,
	} = params;

	// Now we need to establish some values for balance validation and to construct the transaction
	updateStatus(sendFundStatus.calculatingFee);

	const baseTotalAmount = getBaseTotalAmount(
		isSweeping,
		feelessTotal,
		networkFee,
	);

	Log.Balance.requiredBase(baseTotalAmount, isSweeping);

	const {
		remainingUnusedOuts, // this is a copy of the pre-mutation usingOuts
		usingOuts,
		usingOutsAmount,
	} = selectOutputsAndAmountForMixin(
		baseTotalAmount,
		unusedOuts,
		isRingCT,
		isSweeping,
	);

	// v-- now if RingCT compute fee as closely as possible before hand

	const { newFee, totalAmount } = totalAmtAndEstFee({
		baseTotalAmount,
		feelessTotal,
		feePerKB,
		isRingCT,
		isSweeping,
		mixin,
		networkFee,
		remainingUnusedOuts,
		simplePriority,
		usingOuts,
		usingOutsAmount,
	});

	networkFee = newFee;

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
		address: targetAddress,
		amount: feelessTotal,
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
			Log.Amount.toSelf(changeAmount, senderAddress);

			fundTargets.push({
				address: senderAddress,
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

				Log.Amount.toSelf(usableChange, senderAddress);

				fundTargets.push({
					address: senderAddress,
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

		const { numOfKB, serializedSignedTx, txHash } = constructTx({
			senderPublicKeys,
			senderPrivateKeys,

			targetAddress,
			fundTargets,

			pid,
			encryptPid,

			mixOuts,
			mixin,
			usingOuts,

			networkFee,

			isRingCT,

			nettype,
		});

		const feeActuallyNeededByNetwork = calculateFeeKb(
			feePerKB,
			numOfKB,
			multiplyFeePriority(simplePriority),
		);
		// if we need a higher fee
		if (feeActuallyNeededByNetwork.compare(networkFee) > 0) {
			Log.Fee.estLowerThanReal(networkFee, feeActuallyNeededByNetwork);

			// this will update status back to .calculatingFee
			return await _attempt_to_constructFundTransferListAndSendFunds_findingLowestNetworkFee(
				{
					senderAddress,
					senderPublicKeys,
					senderPrivateKeys,

					targetAddress,
					targetAmount,

					pid,
					encryptPid,

					mixin,
					unusedOuts,

					simplePriority,
					feelessTotal,
					feePerKB,
					networkFee: feeActuallyNeededByNetwork,

					isRingCT,
					isSweeping,

					updateStatus,
					api,
					nettype,
				},
			);
		}

		// generated with correct per-kb fee
		const finalNetworkFee = networkFee; // just to make things clear

		Log.Fee.successfulTx(finalNetworkFee);
		updateStatus(sendFundStatus.submittingTransaction);

		await api.submitSerializedSignedTransaction(
			senderAddress,
			senderPrivateKeys,
			serializedSignedTx,
		);

		const txFee = finalNetworkFee; /*.add(hostingService_chargeAmount) NOTE: Service charge removed to reduce bloat for now */
		const ret: SendFundsRet = {
			pid: pid,
			sentAmount: isSweeping
				? parseFloat(monero_utils.formatMoneyFull(feelessTotal))
				: targetAmount,
			targetAddress: targetAddress,
			txFee,
			txHash,
		};
		return ret;
	}
}
