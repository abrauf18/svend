import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { useState } from 'react';
import { useFinAccountsMgmtContext } from '~/components/fin-accounts-mgmt-context';
import { DeleteDialog } from '~/components/ui/dialogs/delete-dialog';
import getUTCDate from '~/utils/get-utc-date';
import useGetParsedCategories from '../hooks/use-get-parsed-categories';
import { FinAccountTransaction } from '~/lib/model/fin.types';
import { toast } from 'sonner';

type Props = {
  transactions: FinAccountTransaction[];
};

export default function TransactionsTable({ transactions }: Props) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const parsedCategories = useGetParsedCategories({ transactions });

  const {
    accountManualTransactionDeleteOne,
    accountTransactionsSideMenuSetSelectedTransaction,
  } = useFinAccountsMgmtContext();

  function handleSelectTransaction(transaction: Props['transactions'][0]) {
    accountTransactionsSideMenuSetSelectedTransaction(transaction.id);
  }

  async function handleDeleteTransaction({
    transactionId,
  }: {
    transactionId: string;
  }) {
    if (isLoading) return;

    try {
      setIsLoading(transactionId);

      const res = await fetch(
        `/api/fin-account-mgmt/manual/transactions/${transactionId}`,
        { method: 'DELETE' },
      );

      if (res.status === 404) {
        toast.error('Transaction not found');
        accountManualTransactionDeleteOne(transactionId);
        return;
      }

      if (!res.ok)
        throw new Error('[Side Menu] Transaction could not be deleted');

      const { data } = await res.json();

      if (!data?.[0]) {
        throw new Error(
          "[TransactionSideMenu] No data was returned from handleDeleteTransacion's query",
        );
      }

      accountManualTransactionDeleteOne(transactionId);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to delete transaction');
    } finally {
      setIsLoading(null);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Delete</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((transaction) => {
            const { category, categoryGroup } =
              parsedCategories[transaction.svendCategoryId!]!;

            return (
              <TableRow
                onClick={() => handleSelectTransaction(transaction)}
                key={transaction.id}
                className={`cursor-pointer`}
              >
                <TableCell>{getUTCDate(transaction.date)}</TableCell>
                <TableCell>
                  {Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: transaction.isoCurrencyCode ?? 'USD',
                  }).format(transaction.amount)}
                </TableCell>
                <TableCell>
                  {categoryGroup} &gt; {category}
                </TableCell>
                <TableCell>
                  <DeleteDialog
                    disabled={!!isLoading}
                    message="Are you sure you want to delete this transaction?"
                    onConfirm={() =>
                      handleDeleteTransaction({ transactionId: transaction.id })
                    }
                  />
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
}
