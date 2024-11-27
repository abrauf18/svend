"use client"

import * as React from "react"
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
} from "@tanstack/react-table"
import {Bookmark} from "lucide-react"

import { Button } from "@kit/ui/button"
import { Checkbox } from "@kit/ui/checkbox"
import {Input} from "@kit/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@kit/ui/table"
import {useState, useEffect, use} from "react";
import { useBudgetWorkspace } from "~/components/budget-workspace-context"
import { BudgetFinAccountTransaction } from "~/lib/model/budget.types"


export function RecurringTable() {
    const [transactions, setTransactions] = useState<BudgetFinAccountTransaction[]>([])
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = useState({})


    const { workspace } = useBudgetWorkspace();

    const columns: ColumnDef<BudgetFinAccountTransaction>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <div className="flex items-center justify-center">
                    <Checkbox
                        checked={
                            table.getIsAllPageRowsSelected() ||
                            (table.getIsSomePageRowsSelected() && "indeterminate")
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
            enableHiding: false
        },
        {
            accessorKey: "date",
            header: "Date",
            cell: ({ row }) => {
                const date = new Date(row.getValue("date"));
                const formattedDate = date.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
                return <div>{formattedDate}</div>;
            },
        },
        {
            accessorKey: "category",
            header: "Category",
            cell: ({ row }) => (
                <div className="capitalize">{row.getValue("category")}</div>
            ),
        },
        // {
        //     accessorKey: "payee",
        //     header: "Payee",
        //     cell: ({ row }) => (
        //         <div className="capitalize">{row.getValue("payee")}</div>
        //     ),
        // },
        // {
        //     accessorKey: "description",
        //     header: "Description",
        //     cell: ({ row }) => (
        //         <div>{row.getValue("description")}</div>
        //     ),
        // },
        {
            accessorKey: "amount",
            header: () =>
                <div className="flex flex-row gap-1 items-center justify-center">
                    Amount
                </div>,
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("amount"));
                // Format the amount as a dollar amount
                const formatted = new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                }).format(amount)
    
                return <div className="font-medium inline-flex flex-row gap-1 items-center justify-end w-full">
                    {formatted}
                </div>
            },
        },
        {
            accessorKey: "account",
            header: "Account",
            cell: ({ row }) => {
                const transaction = row.original;
                const linkedAccount = workspace.budget.linkedFinAccounts.find(
                    account => account.id === transaction.budgetFinAccountId
                );
    
                return (
                    <div>
                        <div className="font-medium">{linkedAccount?.name || 'Unknown Account'}</div>
                        <div className="text-sm text-muted-foreground">
                            {linkedAccount?.mask ? `****${linkedAccount.mask}` : ''}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "isSave",
            header: () =>
                <div className="text-center flex flex-row gap-1 items-center justify-end">
                    <Bookmark  className="h-4 w-4"/>
                </div>,
            cell: ({ row }) => {
                return (
                    <div className="text-center font-medium flex flex-row gap-1 items-center justify-end">
                        <Bookmark  className="h-4 w-4"/>
                    </div>
                )
            },
        }
    ]    

    useEffect(() => {
        setTransactions(workspace.budgetTransactions)
    }, [])

    const table = useReactTable({
        data: transactions,
        columns,
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
    })

    return (
        <div className="w-full">
            <div className="flex items-center py-4">
                <Input
                    placeholder="Search"
                    value={(table.getColumn("account")?.getFilterValue() as string) ?? ""}
                    onChange={(event) =>
                        table.getColumn("account")?.setFilterValue(event.target.value)
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
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
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
                        {table.getFilteredSelectedRowModel().rows.length} of{" "}
                        {table.getFilteredRowModel().rows.length} row(s) selected.
                    </div>
                )}
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
    )
}
