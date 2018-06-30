export const sendFundStatus = {
	fetching_latest_balance: 1,
	calculating_fee: 2,
	fetching_decoy_outputs: 3, // may get skipped if 0 mixin
	constructing_transaction: 4, // may go back to .calculatingFee
	submitting_transaction: 5,
};

export const sendFundsStatusToMessage = {
	1: "Fetching latest balance.",
	2: "Calculating fee.",
	3: "Fetching decoy outputs.",
	4: "Constructing transaction.", // may go back to .calculatingFee
	5: "Submitting transaction.",
};

export type Status = typeof sendFundStatus[keyof typeof sendFundStatus];
