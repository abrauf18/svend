import { CSVType } from '../route';
import checkCSVRowValidity from './check-csv-row-validity';

export default function checkCSVValidity({
  csv,
  csvValidProps,
}: {
  csv: CSVType[];
  csvValidProps: Record<keyof CSVType, boolean>;
}) {
  try {
    //Check if the csv is an array and is not empty
    if (!Array.isArray(csv) || csv.length === 0) {
      return {
        isValid: false,
        error: new Error('CSV must be a non-empty array'),
      };
    }

    const invalidRows = [];

    //Check validity at row level
    for (let i = 0; i < csv.length; i++) {
      const row = csv[i]!;

      const result = checkCSVRowValidity({ row, index: i });

      if (!result.isValid) {
        invalidRows.push(result);
      }
    }

    const requiredProps = new Set(Object.keys(csvValidProps));
    const csvProps = new Set(Object.keys(csv[0]!));

    const missingProps = [...requiredProps].filter(
      (prop) => !csvProps.has(prop),
    );

    const extraProps = [...csvProps].filter((prop) => !requiredProps.has(prop));

    if (missingProps.length > 0 || invalidRows.length > 0) {
      return {
        isValid: false,
        missingProps,
        extraProps,
        invalidRows,
        error: new Error(
          `Missing required properties: ${missingProps.join(', ')}`,
        ),
      };
    }

    return {
      isValid: true,
      missingProps: null,
      extraProps: null,
      invalidRows: null,
    };
  } catch (err: any) {
    console.error(err);
    return {
      isValid: false,
      error: err,
      missingProps: null,
      extraProps: null,
      invalidRows: null,
    };
  }
}
