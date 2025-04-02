import { useBudgetOnboardingContext } from '~/components/budget-onboarding-context';
import InstitutionRender from './institution-render';
import { ManualAccountsSkeleton } from '../../manual-accounts-skeleton';
import { useEffect } from 'react';

type Props = {
  isImportingFile?: boolean;
  isCreatingInstitution?: boolean;
};

export default function InstitutionsRender({ isImportingFile, isCreatingInstitution }: Props) {
  const { state } = useBudgetOnboardingContext();

  const institutions = state.budget.manualInstitutions ?? [];

  useEffect(() => {
    if (isImportingFile || isCreatingInstitution) {
      const skeletonElement = document.querySelector(
        '.plaid-connection-skeleton',
      );
      if (skeletonElement) {
        skeletonElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [isImportingFile, isCreatingInstitution]);

  return (
    <>
      {institutions.map((inst:any) => (
        <InstitutionRender key={inst.id} institution={inst} />
      ))}
      {(isImportingFile || isCreatingInstitution) && (
        <ManualAccountsSkeleton className="plaid-connection-skeleton" />
      )}
    </>
  );
}
