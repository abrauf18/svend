import React from 'react';

import { PayOffDebtInformation } from '~/onboarding/(user)/account/_components/onboarding-step2/part5-goals-debt-info';

export function GoalsDebt(props: {
  initialData: any;
  onValidationChange: (isValid: boolean) => void;
  triggerSubmit: (submitHandler: () => Promise<boolean>) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl p-4">
      <PayOffDebtInformation
        initialData={props.initialData}
        onValidationChange={props.onValidationChange}
        triggerSubmit={props.triggerSubmit}
      />
    </div>
  );
}
