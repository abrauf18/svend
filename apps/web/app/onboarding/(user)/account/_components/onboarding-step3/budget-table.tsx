"use client"

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
import { Info, ArrowRight } from "lucide-react"

import { Button } from "@kit/ui/button"
import { Checkbox } from "@kit/ui/checkbox"
import { Input } from "@kit/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@kit/ui/table"
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@kit/supabase/browser-client"
import { useOnboardingContext } from "~/components/onboarding-context"

type BudgetCategorySpending = {
    category: string,
    spending: number,
    recommendation: number,
    target: number,
    deductions: boolean,
}

export function BudgetTable() {
    const { state } = useOnboardingContext();
    const [budgetCategories, setBudgetCategories] = useState([] as BudgetCategorySpending[])
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] =
        useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = useState({})

    const columns: ColumnDef<BudgetCategorySpending>[] = [
        {
            accessorKey: "category",
            header: "Category",
            cell: ({ row }) => (
                <div className="capitalize text-xs">{row.getValue("category")}</div>
            ),
            size: 200
        },
        {
            accessorKey: "spending",
            header: () =>
                <div className="flex flex-col gap-1 items-center justify-center col-span-1">
                    <div className="text-center">
                        Spending
                    </div>
                    <div className="text-xs text-center inline-flex flex-row gap-1 items-center justify-center">
                        <div>(Average</div>
                        <ArrowRight className="h-4 w-4" />
                        <div>Recommeded)</div>
                    </div>
                </div>,
            cell: ({ row }) => {
                const averageAmount = parseFloat(row.getValue("spending"));
                const recommendedAmount = parseFloat(String(row.original.recommendation));
                // Format the amount as a dollar amount
                const averageFormatted = new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                }).format(averageAmount)

                const recommededFormatted = new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                }).format(recommendedAmount)

                return <div className="text-xs inline-flex flex-row gap-1 items-center justify-center w-full">
                    {averageFormatted}
                    <ArrowRight className="h-4 w-4" />
                    {recommededFormatted}
                </div>
            },
        },
        {
            accessorKey: "target",
            header: () =>
                <div className="text-center">
                    Budget Target
                </div>,
            cell: ({ row }) => {
                const target = parseFloat(row.getValue("target"));
                const [value, setValue] = useState(target)

                const onBlur = () => {
                    // table.options.meta?.updateData(row.index, "target", value)
                }

                return (
                    <div className="text-xs">
                        <Input
                            // type="number"
                            value={value}
                            onChange={(e) => setValue(Number(e.target.value))}
                            onBlur={onBlur}
                            className="w-full text-right px-6"
                        />
                    </div>
                )
            },
            size: 150
        },
        {
            accessorKey: "deductions",
            header: () =>
                <div className="text-center flex flex-row gap-1 items-center justify-end">
                    Tax Deductible
                    <Info className="h-4 w-4" />
                </div>,
            cell: ({ row }) => {
                return (
                    <div className="text-center font-medium flex items-center justify-center h-full">
                        <Checkbox
                            checked={row.getValue("deductions")}
                            onCheckedChange={(value) => updateDeductions(row.index, !!value)}
                            className="h-4 w-4 transition-none transform-none"
                        />
                    </div>
                )
            },
            size: 70
        }
    ]

    const table = useReactTable<BudgetCategorySpending>({
        data: budgetCategories,
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

    const updateDeductions = (rowIndex: number, value: boolean) => {
        setBudgetCategories(prev => prev.map((category, index) =>
            index === rowIndex ? { ...category, deductions: value } : category
        ));
    };

    async function fetchBudget() {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
            .from('budgets')
            .select('*')
            .eq('id', state.account.budgetId as string)
            .single();

        if (error) {
            console.error('Error fetching budget:', error);
            throw error;
        }

        setBudgetCategories(Object.entries(data.category_spending as Record<string, number>).map(([category, spending]) => ({
            category,
            spending,
            recommendation: spending,
            target: spending,
            deductions: false
        })));
    }

    useEffect(() => {
        fetchBudget();
    }, []);

    return (
        <div className="w-full">
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
