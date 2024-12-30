import { cn } from '@kit/ui/utils';
import React from 'react';
import { FieldValues, FormState } from 'react-hook-form';

type Props<T extends FieldValues> = {
  formState: FormState<T>;
  name: keyof T;
  className?: string;
};

export default function RenderError<T extends FieldValues>({
  formState,
  name,
  className,
}: Props<T>) {
  return formState.errors[name] ? (
    <span className={cn('text-sm text-destructive', className)}>
      {formState.errors[name].message as string}
    </span>
  ) : null;
}
