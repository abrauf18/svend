import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { buttonVariants } from '@kit/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { cn } from '@kit/ui/utils';
import React from 'react';
import { CSVState } from '~/lib/model/onboarding.types';

type Props = {
  csvModalInfo: CSVState;
  setCsvModalInfo: React.Dispatch<React.SetStateAction<CSVState>>;
};

export default function CSVInvalidRowsModal({
  csvModalInfo,
  setCsvModalInfo,
}: Props) {
  function handleOpen(open: boolean) {
    if (!open) setCsvModalInfo((prev) => ({ ...prev, isRowsModalOpen: false }));
  }

  if (!csvModalInfo.invalidRows) return null;

  return (
    <AlertDialog
      open={csvModalInfo.isRowsModalOpen && !!csvModalInfo.invalidRows.length}
      onOpenChange={handleOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            CSV Error: Invalid rows
          </AlertDialogTitle>
          <AlertDialogDescription>
            The CSV you uploaded contains one or more rows with invalid data. 
            For some of the fields, we require a specific format. 
            Please review the problematic rows below, update your CSV, and re-upload.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Bank Symbol</TableHead>
                <TableHead>Bank Mask</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {csvModalInfo.invalidRows.map((invalidRow) => (
                <TableRow key={invalidRow.index}>
                  <TableCell>{invalidRow.index + 1}</TableCell>
                  <TableCell
                    className={cn({
                      'bg-red-500/5 text-destructive': !invalidRow.isValidDate
                    })}
                  >
                    {invalidRow.row.TransactionDate}
                  </TableCell>
                  <TableCell
                    className={cn({
                      'bg-red-500/5 text-destructive': !invalidRow.isValidSymbol
                    })}
                  >
                    {invalidRow.row.BankSymbol}
                  </TableCell>
                  <TableCell
                    className={cn({
                      'bg-red-500/5 text-destructive': !invalidRow.isValidMask
                    })}
                  >
                    {invalidRow.row.AccountMask}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'default' }))}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCsvModalInfo((prev) => ({
                ...prev,
                isRowsModalOpen: false,
              }));
            }}
          >
            Dismiss
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
