import { CSVType } from '../route';
import { z } from 'zod';

const symbolSchema = z
  .string({
    invalid_type_error: 'Invalid symbol',
    required_error: 'Symbol is a required field',
  })
  .min(3, { message: 'Symbol must be 3 to 5 letters' })
  .max(5, { message: 'Symbol must be 3 to 5 letters' })
  .refine(
    (data) => {
      if (data.match(/[0-9]/g)) return false;
      return true;
    },
    { message: 'Numbers are not allowed' },
  )
  .transform((data) => data.trim().toUpperCase().replace(/[0-9]/g, ''));

const maskSchema = z
  .string()
  .length(4, { message: 'Mask must be 4 digits' })
  .refine((data) => (data.match(/[^0-9]/g) ? false : true), {
    message: 'Mask should contain only numbers',
  });

const dateSchema = z
  .string()
  .transform((dateStr) => new Date(dateStr))
  .refine((date) => !isNaN(date.getTime()), {
    message: 'Invalid date',
  });

export default function checkCSVRowValidity({
  row,
  index,
}: {
  row: CSVType;
  index: number;
}) {
  try {
    const isValidDate = dateSchema.safeParse(row.Date).success;
    const isValidSymbol = symbolSchema.safeParse(row.BankSymbol).success;
    const isValidMask = maskSchema.safeParse(row.AccountMask).success;

    if (!isValidDate || !isValidSymbol || !isValidMask) {
      return { isValid: false, index, isValidDate, isValidSymbol, isValidMask };
    }

    return { isValid: true };
  } catch (err: any) {
    console.error(err);

    return { isValid: false, error: err };
  }
}
