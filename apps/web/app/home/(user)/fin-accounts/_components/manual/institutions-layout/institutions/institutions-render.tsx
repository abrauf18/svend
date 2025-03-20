'use client';

import InstitutionRender from './institution-render';
import { ManualAccountsSkeleton } from '../../manual-accounts-skeleton';
import { useEffect } from 'react';
import { useFinAccountsMgmtContext } from '~/components/fin-accounts-mgmt-context';
type Props = {
  isImportingFile?: boolean;
  isCreatingInstitution?: boolean;
};

export default function InstitutionsRender({ isImportingFile, isCreatingInstitution }: Props) {
  const { state } = useFinAccountsMgmtContext();

  const institutions = state.account.manualInstitutions ?? [];

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
      {institutions.map((inst) => (
        <InstitutionRender key={inst.id} institution={inst} />
      ))}
      {(isImportingFile ?? isCreatingInstitution) && (
        <ManualAccountsSkeleton className="plaid-connection-skeleton" />
      )}
    </>
  );
}
