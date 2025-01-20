import checkCSVRowValidity from '~/api/onboarding/account/manual/csv/[filename]/_utils/check-csv-row-validity';

export type CSVModalInfoState = {
  rowsModalOpen: boolean;
  open: boolean;
  csvResult: Record<string, any> | null;
  invalidRows: ReturnType<typeof checkCSVRowValidity>[] | null;
};
