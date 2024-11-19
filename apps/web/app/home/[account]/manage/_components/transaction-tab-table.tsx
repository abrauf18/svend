'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Bookmark } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { FinAccountTransaction, FinAccountTransactionBudgetTag } from '~/lib/model/fin.types';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';

interface TransactionTableProps {
  budgetId: string;
  onSelectedTransaction: (row: FinAccountTransaction) => void;
  onOpenChange: (open: boolean) => void;
  onSelectedRowData: (row: FinAccountTransaction) => void;
  refreshTrigger: number;
  selectedMonth: Date;
}

export function TransactionTable({
  budgetId,
  onSelectedTransaction,
  onOpenChange,
  onSelectedRowData,
  refreshTrigger,
  selectedMonth,
}: TransactionTableProps) {
  const [transactions, setTransactions] = useState<FinAccountTransaction[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const { workspace } = useBudgetWorkspace();

  // Private function to format date
  const formatDate = (dateString: string): string => {
    const date = new Date();
    date.setFullYear(Number(dateString.split('-')[0]));
    date.setMonth(Number(dateString.split('-')[1]) - 1);
    date.setDate(Number(dateString.split('-')[2]));
    return date.toLocaleDateString(navigator.language, {
      day: '2-digit',
      month: 'short', 
      year: 'numeric',
    });
  };

  const columns: ColumnDef<FinAccountTransaction>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ row }) => {
        const formattedDate = formatDate(row.getValue('date') as string);
        return <div className="w-[120px]">{formattedDate}</div>;
      },
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <div className="w-[250px] truncate capitalize">{`${row.original.svendCategoryGroup} > ${row.original.svendCategory}`}</div>
      ),
    },
    {
      accessorKey: 'merchant_name',
      header: 'Merchant Name',
      cell: ({ row }) => (
        <div className="w-[120px] truncate capitalize">
          {row.original.merchantName || row.original.payee}
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: () => <div className="w-[120px] pr-2 text-right">Amount</div>,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('amount'));
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(amount);
  
        return <div className="w-[120px] pr-2 text-right">{formatted}</div>;
      },
    },
    {
      accessorKey: 'account',
      header: 'Account',
      cell: ({ row }) => {
        const linkedAccount = workspace?.budget?.linkedFinAccounts?.find(
          (acc) => acc.budgetFinAccountId === row.original.budgetFinAccountId
        );
        const account_name = linkedAccount?.name;
        const account_mask = linkedAccount?.mask;
        return (
          <div className="w-[250px]">
            <span className="truncate font-medium">{account_name}</span>
            &nbsp;&nbsp;
            <span className="text-sm text-muted-foreground">
              ****{account_mask}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'notes',
      header: 'Notes',
      cell: ({ row }) => {
        const notes = (row.getValue('notes') as string) || '';
        const truncatedNotes =
          notes.length > 50 ? `${notes.slice(0, 50)}...` : notes;
        return <div className="w-[250px] truncate">{truncatedNotes}</div>;
      },
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      cell: ({ row, table }) => {
        const tags = row.original.budgetTags;
        if (!tags || !Array.isArray(tags)) return null;
  
        return (
          <div className="flex w-[200px] flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="truncate rounded-md bg-secondary px-2 py-0.5 text-sm text-secondary-foreground hover:cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  const currentFilter =
                    (table.getColumn('tags')?.getFilterValue() as string) || '';
                  const tags = currentFilter
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean);
  
                  const newTags = tags.includes(tag.name)
                    ? tags.filter((t) => t !== tag.name)
                    : [...tags, tag.name];
  
                  table.getColumn('tags')?.setFilterValue(newTags.join(', '));
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        );
      },
      filterFn: (row, columnId, filterValue) => {
        const tags = row.getValue(columnId) as FinAccountTransactionBudgetTag[] | undefined;
        if (!tags) return false;
  
        const searchTags = filterValue
          .split(',')
          .map((tag: any) => tag.trim().toLowerCase())
          .filter(Boolean);
  
        if (searchTags.length === 0) return true;
  
        return searchTags.every((searchTag: any) =>
          tags.some((tag: any) => tag.name.toLowerCase().includes(searchTag)),
        );
      },
    },
    {
      accessorKey: 'isSave',
      header: () => (
        <div className="w-[40px] text-center">
          <Bookmark className="mx-auto h-4 w-4" />
        </div>
      ),
      cell: () => (
        <div className="w-[40px] text-center">
          <Bookmark className="mx-auto h-4 w-4" />
        </div>
      ),
    },
  ];

  useEffect(() => {
    setTransactions(workspace?.budgetTransactions ?? []);
  }, [workspace?.budgetTransactions, refreshTrigger]);

  const table = useReactTable({
    data: transactions,
    columns,
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const { pageSize, pageIndex } = table.getState().pagination;
  const rowRange = {
    start: pageSize * pageIndex + 1,
    end: Math.min(
      pageSize * (pageIndex + 1),
      table.getFilteredRowModel().rows.length,
    ),
  };

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder="Search for anything"
          value={(table.getColumn('tags')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('tags')?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => {
                    onSelectedTransaction(row.original);
                    onOpenChange(true);
                    onSelectedRowData(row.original);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        {table.getFilteredSelectedRowModel().rows.length > 0 && (
          <div className="flex-1 text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{' '}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
        )}
        <div className="text-sm text-muted-foreground">
          Showing rows {rowRange.start}-{rowRange.end} of{' '}
          {table.getFilteredRowModel().rows.length}
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
