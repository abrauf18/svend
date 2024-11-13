import React from 'react';

import { SavingsInformation } from '~/onboarding/(user)/account/_components/onboarding-step2/part4-goals-savings-info';

export function GoalsSavings(props: {
  initialData: any;
  onValidationChange: (isValid: boolean) => void;
  triggerSubmit: (submitHandler: () => Promise<boolean>) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl p-4">
      <SavingsInformation
        initialData={props.initialData}
        onValidationChange={props.onValidationChange}
        triggerSubmit={props.triggerSubmit}
      />
    </div>
  );
}
