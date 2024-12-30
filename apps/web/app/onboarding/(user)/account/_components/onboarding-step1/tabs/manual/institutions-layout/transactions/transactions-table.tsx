import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { useState } from 'react';
import { useOnboardingContext } from '~/components/onboarding-context';
import { DeleteDialog } from '~/components/ui/dialogs/delete-dialog';
import { Database } from '~/lib/database.types';
import getUTCDate from '~/utils/get-utc-date';
import useGetParsedCategories from '../hooks/use-get-parsed-categories';

type Props = {
  transactions: Database['public']['Tables']['fin_account_transactions']['Row'][];
};

export default function TransactionsTable({ transactions }: Props) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const parsedCategories = useGetParsedCategories({ transactions });
  const {
    accountManualTransactionDeleteOne,
    accountTransactionsSideMenuSetSelectedTransaction,
  } = useOnboardingContext();

  function handleSelectTransaction(transaction: Props['transactions'][0]) {
    accountTransactionsSideMenuSetSelectedTransaction(transaction.id);
  }

  async function handleDeleteTransaction({
    transactionId,
  }: {
    transactionId: string;
  }) {
    if (!!isLoading) return;

    try {
      setIsLoading(transactionId);

      const res = await fetch(
        `/api/onboarding/account/manual/transactions/${transactionId}`,
        { method: 'DELETE' },
      );

      if (!res.ok)
        throw new Error('[Side Menu] Transaction could not be deleted');

      const { data } = (await res.json()) as {
        data: {
          deleted_transaction_id: string;
        }[];
      };

      if (data.length === 0)
        throw new Error(
          "[TransactionSideMenu] No data was returned from handleDeleteTransacion's query",
        );

      accountManualTransactionDeleteOne(data[0]!.deleted_transaction_id);
    } catch (err: any) {
      console.error(err);
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
              parsedCategories[transaction.svend_category_id]!;

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
                    currency: transaction.iso_currency_code ?? 'USD',
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
