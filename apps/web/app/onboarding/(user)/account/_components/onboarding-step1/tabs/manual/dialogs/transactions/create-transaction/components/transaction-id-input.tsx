import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import React, { useEffect } from 'react';
import { UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { OnboardingState } from '~/lib/model/onboarding.types';
import generateTransactionId from '../utils/generate-transaction-id';

type Props = {
  state: OnboardingState;
  accountId: string;
  setValue: UseFormSetValue<any>;
  watch: UseFormWatch<any>;
  isAutoGenerating: boolean;
  setIsAutoGenerating: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function TransactionIdInput({
  state,
  accountId,
  setValue,
  watch,
  isAutoGenerating,
  setIsAutoGenerating,
}: Props) {
  useEffect(() => {
    if (isAutoGenerating) {
      setValue('user_tx_id', generateTransactionId({ state, accountId }), {
        shouldValidate: true,
      });
    } else {
      setValue('user_tx_id', '');
    }
  }, [isAutoGenerating]);

  return (
    <div className={`relative flex w-full items-center`}>
      <div
        className={`flex h-[36px] items-center gap-2 ${isAutoGenerating ? 'rounded-md' : 'rounded-l-md'} bg-muted-foreground/5 px-4`}
      >
        <Checkbox
          checked={isAutoGenerating}
          onCheckedChange={() => setIsAutoGenerating((prev) => !prev)}
        />
        <span className={`whitespace-nowrap text-xs`}>Auto generate</span>
      </div>
      {!isAutoGenerating ? (
        <Input
          disabled={isAutoGenerating}
          value={watch('user_tx_id')}
          placeholder="Id"
          className={`rounded-l-none border-l-0`}
          onChange={(e) =>
            setValue('user_tx_id', e.target.value, { shouldValidate: true })
          }
          onInput={(e) =>
            (e.currentTarget.value = e.currentTarget.value.toUpperCase())
          }
        />
      ) : null}
    </div>
  );
}
