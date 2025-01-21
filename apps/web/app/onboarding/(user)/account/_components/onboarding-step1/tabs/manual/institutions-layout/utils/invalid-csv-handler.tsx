import { Button } from '@kit/ui/button';
import { toast } from 'sonner';
import { constants } from '../lib/constants';
import { generateTransactionIdFromCSV } from '../../dialogs/transactions/create-transaction/utils/generate-transaction-id';
import parseCSVResponse from '~/api/onboarding/account/manual/csv/[filename]/_utils/parse-csv-response';
import { CSVModalInfoState } from '../types/states.types';

type Props = {
  error: any;
  setIsLearnMoreOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCsvModalInfo: React.Dispatch<React.SetStateAction<CSVModalInfoState>>;
};

export default async function invalidCsvHandler({
  error,
  setIsLearnMoreOpen,
  setCsvModalInfo,
}: Props) {
  try {
    const missingHaveDefaults =
      error.missingProps.length > 0
        ? error.missingProps.every((prop: string) =>
            constants.propsWithDefaults.includes(prop),
          )
        : false;

    const withoutDefaultMissingProps = error.missingProps.filter(
      (mp: string) => !constants.propsWithDefaults.includes(mp),
    );

    if (withoutDefaultMissingProps.length > error.extraProps.length) {
      toast.error(
        <div className={`flex w-full flex-col gap-2`}>
          <p>{`There aren't sufficient unknown columns to cover the missing ones: ${withoutDefaultMissingProps.join(', ')}`}</p>
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

    if (
      (!error.missingProps ||
        error.missingProps.length === 0 ||
        missingHaveDefaults) &&
      error.invalidRows &&
      error.invalidRows.length > 0
    ) {
      setCsvModalInfo((prev) => ({
        ...prev,
        invalidRows: error.invalidRows,
        rowsModalOpen: true,
        csvResult: error,
      }));

      return { result: null, error: null };
    }

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

      //If there are missing columns with defaults, it sends the request again with the defaults
      const res = await fetch('/api/onboarding/account/manual/csv/mapped', {
        method: 'POST',
        body: JSON.stringify({ mappedCsv: parsedCsvData }),
      });

      if (res.ok) {
        //If mapped response is ok, is because there are not invalid rows
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
          <p>{`No columns were found to satisfy missing column(s): ${error.missingProps.filter((mp: string) => !constants.propsWithDefaults.includes(mp)).join(', ')}`}</p>
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

    //If there are extra columns, it opens the modal to map the columns
    setCsvModalInfo((prev) => ({
      ...prev,
      open: true,
      csvResult: error,
    }));

    return { result: null, error: null };
  } catch (err: any) {
    console.error(err);

    return { result: null, error: err };
  }
}
