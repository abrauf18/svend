import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { buttonVariants } from '@kit/ui/button';
import { Divider } from '@kit/ui/divider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';
import { Loader2, StarIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useBudgetOnboardingContext } from '~/components/budget-onboarding-context';
import { constants } from '../lib/constants';
import { AccountOnboardingManualInstitution, CSVColumns, CSVState } from '~/lib/model/onboarding.types';

type Props = {
  csvModalInfo: CSVState;
  setCsvModalInfo: React.Dispatch<React.SetStateAction<Props['csvModalInfo']>>;
};

export default function CsvColumnsMapperModal({
  csvModalInfo,
  setCsvModalInfo,
}: Props) {
  const [selectedColumns, setSelectedColumns] = useState<
    Record<string, string>
  >({});

  const { accountManualInstitutionsAddMany,budgetSlug } = useBudgetOnboardingContext();

  const [loading, setLoading] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!csvModalInfo.isModalOpen) {
      setSelectedColumns({});
      setLoading(false);
    }
  }, [csvModalInfo.isModalOpen]);

  function handleOpen(open: boolean) {
    if (!open) {
      setCsvModalInfo((prev) => ({ 
        ...prev, 
        isModalOpen: false,
        csvResult: null,
        columns: {} as CSVColumns,
        extraColumns: [],
        rawData: [],
        processedData: null
      }));
    }
  }

  function handleSelect(extraColumn: string, missingColumn: string) {
    setSelectedColumns((prev) => ({
      ...prev,
      [missingColumn]: extraColumn,
    }));
  }

  async function handleSubmit() {
    setLoading(true);

    if (!csvModalInfo.filename) {
      toast.error('No file selected');
      setLoading(false);
      return;
    }

    const columnMappings = Object.entries(selectedColumns).map(([internalColumn, csvColumn]) => ({
      internalColumn,
      csvColumn
    }));

    const res = await fetch(`/api/onboarding/budget/${budgetSlug}/manual/csv/mapped`, {
      method: 'POST',
      body: JSON.stringify({
        filename: csvModalInfo.filename,
        columnMappings
      }),
    });

    if (res.ok) {
      setCsvModalInfo((prev) => ({ ...prev, csvResult: null, isModalOpen: false }));
      const { institutions, summary, error } = (await res.json()) as {
        institutions?: AccountOnboardingManualInstitution[];
        summary?: { newInstitutions: number; newAccounts: number; newTransactions: number };
        error?: string;
      };

      if (error) {
        console.error('financial data import error:', error);
        toast.error('Could not import financial data');
        return;
      }

      if (summary) {
        const totalNew = summary.newInstitutions + summary.newAccounts + summary.newTransactions;
        if (totalNew > 0) {
          toast.success(
            'Successfully added:',
            {
              description: (
                <div className="flex flex-col gap-0.5">
                  {summary.newInstitutions > 0 && (
                    <div><b>{summary.newInstitutions}</b> institutions</div>
                  )}
                  {summary.newAccounts > 0 && (
                    <div><b>{summary.newAccounts}</b> accounts</div>
                  )}
                  {summary.newTransactions > 0 && (
                    <div><b>{summary.newTransactions}</b> transactions</div>
                  )}
                </div>
              )
            }
          );
        } else {
          toast.warning('No new data was added from the CSV file');
        }
      }

      if (institutions) {
        accountManualInstitutionsAddMany(institutions);
      }
    } else {
      const isJson = res.headers.get('content-type') === 'application/json';

      if (!isJson) {
        toast.error('A server error has ocurred');

        return setLoading(false);
      }

      const { invalidRows, csvData } = await res.json();

      if (invalidRows)
        setCsvModalInfo((prev) => ({
          ...prev,
          invalidRows,
          isModalOpen: false,
          isRowsModalOpen: true,
          csvResult: {
            csvData,
            missingProps: [],
            extraProps: [],
          },
        }));
    }

    setLoading(false);
  }

  if (!csvModalInfo.csvResult) return null;

  return (
    <AlertDialog
      open={csvModalInfo.isModalOpen && !!csvModalInfo.csvResult}
      onOpenChange={handleOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>CSV Error: Missing required columns</AlertDialogTitle>
          <AlertDialogDescription>
            The CSV you uploaded is missing one or more required columns.  However, we detected additional columns 
            that could be mapped to the ones that are compatible with Svend.  Please select the appropriate columns
            to map to the ones that are compatible with Svend or cancel and re-upload the CSV with the correct columns.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Divider />
        <div className={`flex flex-col gap-2`}>
          <div
            className={`flex items-center justify-between text-sm text-muted-foreground`}
          >
            <p>Missing Columns</p>
            <p>Mappable CSV Columns</p>
          </div>
          {csvModalInfo.csvResult!.missingProps.map((mp: string) => (
            <div key={mp} className={`flex items-center justify-between gap-2`}>
              <div>{mp}</div>
              <div className={`w-[50%]`}>
                <Select
                  disabled={false}
                  onValueChange={(value) => handleSelect(value, mp)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column">
                      {selectedColumns[mp] ?? 'Select column'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {constants.propsWithDefaults.includes(mp) ? (
                      <SelectItem value={'auto-generate'}>
                        <span className="flex items-center gap-2 text-sm">
                          <StarIcon size={12} /> Auto generate
                        </span>
                      </SelectItem>
                    ) : null}
                    {(csvModalInfo.csvResult!.extraProps ?? []).map(
                      (col: string) => (
                        <SelectItem
                          key={col}
                          value={col}
                          disabled={Object.entries(selectedColumns).some(
                            ([key, value]) => value === col && key !== mp
                          )}
                        >
                          <span className="text-sm">{col}</span>
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={(e) => e.stopPropagation()}
            disabled={loading}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'default' }))}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSubmit();
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Update'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
