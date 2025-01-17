import { OnboardingState } from '~/lib/model/onboarding.types';

type Props = {
  state: OnboardingState;
  accountId: string;
};

export default function generateTransactionId({ state, accountId }: Props) {
  const institution = state.account.manualInstitutions?.find((inst) =>
    inst.accounts.some((acc) => acc.id === accountId),
  );

  if (!institution) return null;

  const account = institution.accounts.find((acc) => acc.id === accountId);

  if (!account) return null;

  let currentNum = 1;
  let transactionId: string;

  do {
    const randomNum = String(currentNum).padStart(8, '0');
    transactionId = `${institution.symbol}${account.mask}${randomNum}`;

    const exists = account.transactions.some(
      (trans) => trans.user_tx_id === transactionId,
    );

    if (!exists) break;

    currentNum++;
  } while (true);

  return transactionId;
}

export function generateTransactionIdFromCSV({
  bankSymbol,
  bankMask,
  index,
}: {
  bankSymbol: string;
  bankMask: string;
  index: number;
}) {
  try {
    let currentNum = index;
    let transactionId: string;

    const randomNum = String(currentNum).padStart(8, '0');
    transactionId = `${bankSymbol}${bankMask}${randomNum}`;

    return transactionId;
  } catch (err: any) {
    console.error(err);

    return null;
  }
}
