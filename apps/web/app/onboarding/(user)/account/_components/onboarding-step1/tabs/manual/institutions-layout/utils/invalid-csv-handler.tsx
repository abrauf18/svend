import { Button } from '@kit/ui/button';
import { toast } from 'sonner';
import { CSVColumns, CSVState } from '~/lib/model/onboarding.types';

type Props = {
  error: any;
  setIsLearnMoreOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCsvModalInfo: React.Dispatch<React.SetStateAction<CSVState>>;
  filename: string;
};

export default async function invalidCsvHandler({
  error,
  setIsLearnMoreOpen,
  setCsvModalInfo,
  filename,
}: Props) {
  try {
    const missingProps = error.missingProps || [];
    const mappableProps = error.mappableProps || [];
    
    // Case 1: Missing required columns with no mappable columns
    if (missingProps.length > mappableProps.length) {
      toast.error(
        <div className="flex w-full flex-col gap-2">
          <p>Missing required columns and not enough mappable columns found: </p>
          <p><b>Missing: </b>{missingProps.join(', ')}</p>
          <p><b>Mappable: </b>{mappableProps.join(', ')}</p>
          <Button
            variant="ghost"
            onClick={() => setIsLearnMoreOpen(true)}
            className="outline outline-1 outline-red-400"
          >
            CSV Import Guide
          </Button>
        </div>,
        { duration: 10000 }
      );
      return { result: null, error: null };
    }

    // Case 2: Invalid row values
    if (error.invalidRows?.length > 0) {
      setCsvModalInfo((prev) => ({
        ...prev,
        invalidRows: error.invalidRows,
        isRowsModalOpen: true,
        csvResult: error,
      }));
      return { result: null, error: null };
    }

    // Case 3: Missing columns but we have enough mappable columns to map
    if (missingProps.length > 0 && mappableProps.length >= missingProps.length) {
      setCsvModalInfo((prev) => ({
        ...prev,
        isModalOpen: true,
        filename: filename,
        columns: {
          ...prev.columns,
          ...Object.fromEntries(
            missingProps.map((prop: keyof CSVColumns) => [
              prop,
              {
                originalName: null,
                isValid: false,
                canAutoGenerate: false,
              },
            ]),
          ),
        },
        extraColumns: mappableProps,
        rawData: error.csvData || [],
        csvResult: {
          csvData: error.csvData,
          missingProps: error.missingProps,
          extraProps: error.mappableProps
        }
      }));
      return { result: null, error: null };
    }

    return { result: null, error: new Error('Unhandled CSV validation case') };
  } catch (err: any) {
    console.error(err);
    return { result: null, error: err };
  }
}
