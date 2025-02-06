import { CSVRow } from '../model/onboarding.types';

export default function checkCSVRowValidity({
  row,
  index,
}: {
  row: CSVRow;
  index: number;
}) {
  const isValidDate = row.TransactionDate ? /^\d{2}\/\d{2}\/\d{4}$/.test(row.TransactionDate) : false;
  const isValidSymbol = row.BankSymbol ? /^[A-Z]+$/.test(row.BankSymbol) : false;
  const isValidMask = row.AccountMask ? /^\d{4}$/.test(row.AccountMask) : false;
  const isValidStatus = row.TransactionStatus ? 
    ['pending', 'posted'].includes(row.TransactionStatus.toLowerCase()) : 
    false;

  return {
    isValid: isValidDate && isValidSymbol && isValidMask && isValidStatus,
    index,
    isValidDate,
    isValidSymbol,
    isValidMask,
    isValidStatus,
    row
  };
}
