import { CSVType } from '../route';

export default function checkCSVValidity({
  csv,
  csvValidProps,
}: {
  csv: CSVType[];
  csvValidProps: Record<keyof CSVType, boolean>;
}) {
  try {
    if (!Array.isArray(csv) || csv.length === 0) {
      return {
        isValid: false,
        error: new Error('CSV must be a non-empty array'),
      };
    }

    const requiredProps = new Set(Object.keys(csvValidProps));
    const csvProps = new Set(Object.keys(csv[0]!));

    const missingProps = [...requiredProps].filter(
      (prop) => !csvProps.has(prop),
    );

    const extraProps = [...csvProps].filter((prop) => !requiredProps.has(prop));

    if (missingProps.length > 0) {
      return {
        isValid: false,
        missingProps,
        extraProps,
        error: new Error(
          `Missing required properties: ${missingProps.join(', ')}`,
        ),
      };
    }

    return { isValid: true, missingProps: null, extraProps: null };
  } catch (err: any) {
    console.error(err);
    return { isValid: false, error: err, missingProps: null, extraProps: null };
  }
}
