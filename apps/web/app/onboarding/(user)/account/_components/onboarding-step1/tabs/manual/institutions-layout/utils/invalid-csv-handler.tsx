import { Button } from '@kit/ui/button';
import { toast } from 'sonner';
import { constants } from '../lib/constants';
import { generateTransactionIdFromCSV } from '../../dialogs/transactions/create-transaction/utils/generate-transaction-id';
import parseCSVResponse from '~/api/onboarding/account/manual/csv/[filename]/_utils/parse-csv-response';

type Props = {
  error: any;
  setIsLearnMoreOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCsvModalInfo: React.Dispatch<
    React.SetStateAction<{
      open: boolean;
      csvResult: any;
    }>
  >;
};

export default async function invalidCsvHandler({
  error,
  setIsLearnMoreOpen,
  setCsvModalInfo,
}: Props) {
  try {
    const missingHaveDefaults = error.missingProps.every((prop: string) =>
      constants.propsWithDefaults.includes(prop),
    );

    if (missingHaveDefaults) {
      const parsedCsvData = [];

      for (let i = 0; i < error.csvData.length; i++) {
        const item = error.csvData[i];
        const parsedItem = { ...item };

        if (error.missingProps.includes('TransactionId')) {
          parsedItem.TransactionId = generateTransactionIdFromCSV({
            bankMask: item.AccountMask,
            bankSymbol: item.BankSymbol,
            index: i,
          });
        }

        parsedCsvData.push(parsedItem);
      }

      const res = await fetch('/api/onboarding/account/manual/csv/mapped', {
        method: 'POST',
        body: JSON.stringify({ mappedCsv: parsedCsvData }),
      });

      if (res.ok) {
        const result = (await res.json()) as {
          institutions?: ReturnType<typeof parseCSVResponse>;
          error?: string;
        };

        if (result.error) {
          throw new Error(result.error);
        }

        toast.success(
          `Used default values for missing columns: ${error.missingProps.join(', ')}`,
        );

        return { result: result.institutions, error: null };
      }
    }

    if (!error.extraProps || error.extraProps.length === 0) {
      toast.error(
        <div className={`flex w-full flex-col gap-2`}>
          <p>{`No columns to satisfy missing column(s): ${error.missingProps.join(', ')}`}</p>
          <Button
            variant={'ghost'}
            onClick={() => setIsLearnMoreOpen(true)}
            className="outline outline-1 outline-red-400"
          >
            CSV Import Guide
          </Button>
        </div>,
        { duration: 5000 },
      );

      return { result: null, error: null };
    }

    setCsvModalInfo({ open: true, csvResult: error });

    return { result: null, error: null };
  } catch (err: any) {
    console.error(err);

    return { result: null, error: err };
  }
}
