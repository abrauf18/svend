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
import React, { useState } from 'react';
import { CSVModalInfoState } from '../types/states.types';

type Props = {
  csvModalInfo: CSVModalInfoState;
  setCsvModalInfo: React.Dispatch<React.SetStateAction<Props['csvModalInfo']>>;
};

export default function CSVInvalidRowsModal({
  csvModalInfo,
  setCsvModalInfo,
}: Props) {
  const [loading, setLoading] = useState(false);

  function handleOpen(open: boolean) {
    if (!open) setCsvModalInfo((prev) => ({ ...prev, open: false }));
  }

  if (!csvModalInfo.invalidRows || !csvModalInfo.csvResult) return null;

  return (
    <AlertDialog
      open={csvModalInfo.rowsModalOpen && !!csvModalInfo.invalidRows.length}
      onOpenChange={handleOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Oops, there are invalid rows&apos; fields
          </AlertDialogTitle>
          <AlertDialogDescription>
            There are invalid rows&apos; fields that could be mapped to the ones
            that are compatible with Svend.
          </AlertDialogDescription>
        </AlertDialogHeader>
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
            {csvModalInfo.invalidRows.map((invalidRow) => {
              const csvRow = csvModalInfo.csvResult!.csvData[invalidRow.index!];

              return (
                <TableRow key={invalidRow.index!}>
                  <TableCell>{invalidRow.index! + 1}</TableCell>
                  <TableCell
                    className={`${!invalidRow.isValidDate ? 'bg-red-500/5 text-destructive' : ''}`}
                  >
                    {csvRow.Date}
                  </TableCell>
                  <TableCell
                    className={`${!invalidRow.isValidSymbol ? 'bg-red-500/5 text-destructive' : ''}`}
                  >
                    {csvRow.BankSymbol}
                  </TableCell>
                  <TableCell
                    className={`${!invalidRow.isValidMask ? 'bg-red-500/5 text-destructive' : ''}`}
                  >
                    {csvRow.AccountMask}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <AlertDialogFooter>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'default' }))}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCsvModalInfo((prev) => ({
                ...prev,
                rowsModalOpen: false,
              }));
            }}
          >
            Accept
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
