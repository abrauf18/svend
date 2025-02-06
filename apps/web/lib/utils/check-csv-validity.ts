import { CSVRow } from '~/lib/model/onboarding.types';
import checkCSVRowValidity from './check-csv-row-validity';

export default function checkCSVValidity({
  csv,
  csvValidProps,
}: {
  csv: CSVRow[];
  csvValidProps: Record<keyof CSVRow, boolean>;
}) {
  try {
    //Check if the csv is an array and is not empty
    if (!Array.isArray(csv) || csv.length === 0) {
      return {
        isValid: false,
        error: new Error('CSV must be a non-empty array'),
        missingProps: [],
        mappableProps: [],
        invalidRows: [],
      };
    }

    // Filter out empty rows first
    const validCsv = csv.filter(row => {
      // Check if row has any non-empty values
      return Object.values(row).some(value => value && value.trim() !== '');
    });

    const invalidRows = [];

    //Check validity at row level - this uses the zod schemas defined in checkCSVRowValidity
    for (let i = 0; i < validCsv.length; i++) {
      const row = validCsv[i]!;
      const result = checkCSVRowValidity({ row, index: i });

      if (!result.isValid) {
        invalidRows.push({
          ...result,
          row  // Include the row data for debugging
        });
      }
    }

    const requiredProps = new Set(Object.keys(csvValidProps));
    const csvProps = new Set(Object.keys(csv[0]!));

    const missingProps = [...requiredProps].filter(
      (prop) => !csvProps.has(prop),
    );

    const mappableProps = [...csvProps].filter((prop) => !requiredProps.has(prop));

    if (missingProps.length > 0 || invalidRows.length > 0) {
      const errorMessages = [];
      if (missingProps.length > 0) {
        errorMessages.push(`Missing required properties: ${missingProps.join(', ')}`);
      }
      if (invalidRows.length > 0) {
        const invalidDetails = invalidRows.map(r => 
          `Row ${(r.index ?? -2) + 1}: ${[
            !r.isValidDate && 'invalid date',
            !r.isValidSymbol && 'invalid bank symbol',
            !r.isValidMask && 'invalid account mask',
            !r.isValidStatus && 'invalid status'
          ].filter(Boolean).join(', ')}`
        );
        errorMessages.push(`Invalid data in rows: ${invalidDetails.join('; ')}`);
      }

      return {
        isValid: false,
        missingProps,
        mappableProps,
        invalidRows,
        error: new Error(errorMessages.join('. ')),
      };
    }

    return {
      isValid: true,
      missingProps: [],
      mappableProps: [],
      invalidRows: [],
      error: null,
    };
  } catch (err: any) {
    console.error(err);
    return {
      isValid: false,
      error: new Error(err.message || 'An error occurred while validating the CSV'),
      missingProps: [],
      mappableProps: [],
      invalidRows: [],
    };
  }
}
