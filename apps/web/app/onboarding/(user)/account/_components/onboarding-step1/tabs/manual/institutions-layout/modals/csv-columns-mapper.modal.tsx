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
import { useState } from 'react';
import { toast } from 'sonner';
import parseCSVResponse from '~/api/onboarding/account/manual/csv/[filename]/_utils/parse-csv-response';
import { useOnboardingContext } from '~/components/onboarding-context';
import { generateTransactionIdFromCSV } from '../../dialogs/transactions/create-transaction/utils/generate-transaction-id';
import { constants } from '../lib/constants';
import { CSVModalInfoState } from '../types/states.types';

type Props = {
  csvModalInfo: CSVModalInfoState;
  setCsvModalInfo: React.Dispatch<React.SetStateAction<Props['csvModalInfo']>>;
};

export default function CsvColumnsMapperModal({
  csvModalInfo,
  setCsvModalInfo,
}: Props) {
  const [selectedColumns, setSelectedColumns] = useState<
    Record<string, string>
  >({});

  const { accountManualInstitutionsAddMany } = useOnboardingContext();

  const [loading, setLoading] = useState(false);

  function handleOpen(open: boolean) {
    if (!open)
      setCsvModalInfo((prev) => ({ ...prev, open: false, csvResult: null }));
  }

  function handleSelect(extraColumn: string, missingColumn: string) {
    setSelectedColumns((prev) => ({
      ...prev,
      [missingColumn]: extraColumn,
    }));
  }

  async function handleSubmit() {
    setLoading(true);

    const csvData = csvModalInfo.csvResult!.csvData as Record<string, any>[];

    const newCsvData = csvData.map((row, index) => {
      const newRow = structuredClone(row);

      Object.entries(selectedColumns).forEach(
        ([missingColumn, extraColumn]) => {
          if (extraColumn === 'auto-generate') {
            //TODO: Should be dynamic for each type of column
            const transactionId = generateTransactionIdFromCSV({
              bankSymbol: row.BankSymbol ?? row[selectedColumns['BankSymbol']!],
              bankMask: row.AccountMask ?? row[selectedColumns['AccountMask']!],
              index,
            });

            if (!transactionId) return;

            newRow[missingColumn] = transactionId;
            delete newRow[extraColumn];
          } else {
            newRow[missingColumn] = row[extraColumn];
            delete newRow[extraColumn];
          }
        },
      );

      return newRow;
    });

    console.log(newCsvData);

    const res = await fetch('/api/onboarding/account/manual/csv/mapped', {
      method: 'POST',
      body: JSON.stringify({ mappedCsv: newCsvData }),
    });

    if (res.ok) {
      setCsvModalInfo((prev) => ({ ...prev, csvResult: null, open: false }));
      const { institutions, error } = (await res.json()) as {
        institutions?: ReturnType<typeof parseCSVResponse>;
        error?: string;
      };

      if (error) {
        console.error('financial data import error:', error);
        toast.error('Could not import financial data', {
          position: 'bottom-center',
          duration: 3000,
        });
      }
      if (!institutions) {
        toast.warning('No financial data imported', {
          position: 'bottom-center',
          duration: 3000,
        });
      }

      accountManualInstitutionsAddMany(institutions!);
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
          open: false,
          rowsModalOpen: true,
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
      open={csvModalInfo.open && !!csvModalInfo.csvResult}
      onOpenChange={handleOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Oops, there are missing columns</AlertDialogTitle>
          <AlertDialogDescription>
            There are missing columns that could be mapped to the ones that are
            compatible with Svend.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Divider />
        <div className={`flex flex-col gap-2`}>
          <div
            className={`flex items-center justify-between text-sm text-muted-foreground`}
          >
            <p>Missing Columns</p>
            <p>Extra CSV Columns</p>
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
                          disabled={
                            Object.values(selectedColumns).includes(col) &&
                            selectedColumns[mp] !== col
                          }
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
