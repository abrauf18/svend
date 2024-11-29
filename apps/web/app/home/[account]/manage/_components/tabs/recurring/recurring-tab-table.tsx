'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';

import { File, Files } from 'lucide-react';

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

import { BudgetFinAccountRecurringTransaction } from '~/lib/model/budget.types';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { useDebounce } from '~/lib/hooks/use-debounce';
import { TransactionSearchService } from '~/lib/services/transaction-search.service';

interface RecurringTableProps {
  onSelectTransaction: (row: BudgetFinAccountRecurringTransaction) => void;
  onOpenChange: (open: boolean) => void;
  selectedMonth: Date;
}

export function RecurringTable(props: RecurringTableProps) {
  const transactionSearchService = React.useMemo(() => new TransactionSearchService(), []);

  const [transactions, setTransactions] = useState<BudgetFinAccountRecurringTransaction[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebounce(searchValue, 500);
  const [scoredTransactionIds, setScoredTransactionIds] = useState<Set<string>>(new Set());

  const { workspace } = useBudgetWorkspace();

  // Keep track of base transactions separately
  const [baseTransactions, setBaseTransactions] = useState<BudgetFinAccountRecurringTransaction[]>([]);
  
  // Update base transactions when workspace or month changes
  useEffect(() => {
    if (!workspace?.budgetRecurringTransactions) return;

    const filteredTransactions = workspace.budgetRecurringTransactions.filter((budgetTransaction) => {
      const latestDate = getLatestTransactionDate(budgetTransaction);
      const selectedMonth = props.selectedMonth.getMonth();
      const selectedYear = props.selectedMonth.getFullYear();
      
      return latestDate.getMonth() === selectedMonth && 
             latestDate.getFullYear() === selectedYear;
    });

    // Sort transactions by date before setting them
    const sortedTransactions = [...filteredTransactions].sort((a, b) => {
      const dateA = getLatestTransactionDate(a).getTime();
      const dateB = getLatestTransactionDate(b).getTime();
      return dateB - dateA; // Descending order
    });

    setBaseTransactions(sortedTransactions);
    setTransactions(sortedTransactions);
  }, [workspace?.budgetRecurringTransactions, props.selectedMonth]);

  // Sort transactions based on search
  useEffect(() => {
    const searchTerms = debouncedSearch.split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);
    
    if (searchTerms.length === 0 || !debouncedSearch.trim()) {
      setTransactions(baseTransactions);
      setScoredTransactionIds(new Set());
      return;
    }

    const scoredTransactions = baseTransactions.map(t => {
      const associatedTransactions = workspace?.budgetTransactions?.filter(
        bt => t.transaction.finAccountTransactionIds.includes(bt.transaction.id)
      ) ?? [];

      return {
        budgetTransaction: t,
        score: transactionSearchService.getRecurringWithAssociatedScore(
          t, 
          searchTerms,
          workspace?.budgetTags ?? [],
          associatedTransactions
        )
      };
    });

    const matchedIds = new Set(
      scoredTransactions
        .filter(st => st.score > 0)
        .map(st => st.budgetTransaction.transaction.id)
    );
    setScoredTransactionIds(matchedIds);

    const hasMatches = matchedIds.size > 0;
    if (hasMatches) {
      setTransactions(
        scoredTransactions
          .sort((a, b) => b.score - a.score)
          .map(st => st.budgetTransaction)
      );
    } else {
      setTransactions(baseTransactions);
    }
  }, [debouncedSearch, baseTransactions, workspace?.budgetTransactions]);

  const getLatestTransactionDate = (recurringTransaction: BudgetFinAccountRecurringTransaction): Date => {
    // Get all associated transactions
    const associatedTransactions = workspace?.budgetTransactions?.filter(
      t => recurringTransaction.transaction.finAccountTransactionIds.includes(t.transaction.id)
    ) ?? [];

    // If no associated transactions, return a default date (e.g., start of current month)
    if (associatedTransactions.length === 0) {
      const date = new Date();
      date.setDate(1);
      return date;
    }

    // Find the latest date
    return associatedTransactions.reduce((latest, current) => {
      const [year, month, day] = current.transaction.date.split('-').map(Number);
      const currentDate = new Date(year!, month! - 1, day!);
      return currentDate > latest ? currentDate : latest;
    }, new Date(0));
  };

  const columns: ColumnDef<BudgetFinAccountRecurringTransaction>[] = [
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
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
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
      header: 'Latest Transaction Date',
      cell: ({ row }) => {
        const latestDate = getLatestTransactionDate(row.original);
        return <div className="w-[120px]">
          {latestDate.toLocaleDateString(navigator.language, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </div>;
      },
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => {
        // First try to use categoryId to get the current category
        if (row.original.categoryId) {
          const allCategories = Object.values(workspace?.budgetCategories ?? {}).flatMap(
            (group) => group.categories
          );
          const category = allCategories.find((cat) => cat.id === row.original.categoryId);
          const group = Object.values(workspace?.budgetCategories ?? {}).find((group) =>
            group.categories.some((cat) => cat.id === row.original.categoryId)
          );

          if (category && group) {
            return (
              <div className="w-[350px] truncate capitalize">
                {`${group.name} > ${category.name}`}
              </div>
            );
          }
        }

        // Fallback to svend categories if no categoryId or category not found
        return (
          <div className="w-[250px] truncate capitalize">
            {`${row.original.categoryGroup} > ${row.original.category}`}
          </div>
        );
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
          <div className="w-[150px]">
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
      cell: ({ row }) => {
        const tags = row.original.budgetTags;
        if (!tags || !Array.isArray(tags)) return null;

        return (
          <div className="w-[200px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-1 overflow-x-auto pb-4 -mb-4">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="whitespace-nowrap rounded-md bg-secondary px-2 py-0.5 text-sm text-secondary-foreground hover:cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    const currentTerms = searchValue.split(',').map(t => t.trim()).filter(Boolean);
                    const newTerms = currentTerms.includes(tag.name)
                      ? currentTerms.filter(t => t !== tag.name)
                      : [...currentTerms, tag.name];

                    setSearchValue(newTerms.join(', '));
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        );
      },
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const tags = row.original.budgetTags;
        if (!tags) return false;

        const searchTerms = filterValue
          .split(',')
          .map((term: string) => term.trim().toLowerCase())
          .filter(Boolean);

        if (searchTerms.length === 0) return true;

        return tags.some(tag =>
          searchTerms.some((term: string) => tag.name.toLowerCase().includes(term))
        );
      },
    },
  ];

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
          placeholder="Search and sort by tags (comma-separated)"
          value={searchValue}
          onChange={(event) => {
            setSearchValue(event.target.value);
          }}
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
                    props.onSelectTransaction(row.original);
                    props.onOpenChange(true);
                  }}
                  className={`h-[52px] ${
                    debouncedSearch.trim() && !scoredTransactionIds.has(row.original.transaction.id)
                      ? 'opacity-50'
                      : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
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
