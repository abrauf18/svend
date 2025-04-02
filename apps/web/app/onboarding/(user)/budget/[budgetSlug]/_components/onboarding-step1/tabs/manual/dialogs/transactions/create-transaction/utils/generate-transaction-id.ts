import { OnboardingState } from '~/lib/model/budget.onboarding.types';

type Props = {
  state: OnboardingState;
  budgetId: string;
};

export default function generateTransactionId({ state, budgetId }: Props) {
  const institution = state.budget.manualInstitutions?.find((inst) =>
    inst.accounts.some((acc) => acc.id === budgetId),
  );

  if (!institution) return null;

  const budget = institution.accounts.find((acc) => acc.id === budgetId);

  if (!budget) return null;

  let currentNum = 1;
  let transactionId: string;

  do {
    const randomNum = String(currentNum).padStart(8, '0');
    transactionId = `${institution.symbol}${budget.mask}${randomNum}`;

    const exists = budget.transactions.some(
      (trans) => trans.userTxId === transactionId,
    );

    if (!exists) break;

    currentNum++;
  } while (true);

  return transactionId;
}
