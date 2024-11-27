import React from 'react';

import { InvestmentInformation } from '~/onboarding/(user)/account/_components/onboarding-step2/part6-goals-investment-info';

export function GoalsInvestment(props: {
  initialData: any;
  onValidationChange: (isValid: boolean) => void;
  triggerSubmit: (submitHandler: () => Promise<boolean>) => void;
}) {
  return (
    <InvestmentInformation
      initialData={props.initialData}
      onValidationChange={props.onValidationChange}
      triggerSubmit={props.triggerSubmit}
    />
  );
}
