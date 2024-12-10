'use client';

import React, { useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Trans } from '@kit/ui/trans';

import { TransactionPanel } from '~/home/[account]/manage/_components/transaction-panel';
import TransactionMonthlyExpenseSummary from '~/home/[account]/manage/_components/transaction-monthly-expense-summary';
import { TransactionTable } from '~/home/[account]/manage/_components/transaction-tab-table';
import { BudgetFinAccountTransaction } from '~/lib/model/budget.types';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';

function TransactionTab() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<
    BudgetFinAccountTransaction | undefined
  >(undefined);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { workspace } = useBudgetWorkspace();

  // Find earliest transaction date
  const earliestDate = React.useMemo(() => {
    if (!workspace?.budgetTransactions?.length) return null;
    
    return workspace.budgetTransactions.reduce((earliest, current) => {
      const [year, month] = current.transaction.date.split('-').map(Number);
      const currentDate = new Date(year!, month! - 1); // month is 0-based in JS Date
      
      if (!earliest) return currentDate;
      return currentDate < earliest ? currentDate : earliest;
    }, null as Date | null);
  }, [workspace?.budgetTransactions]);

  // Check if current selected date is the earliest month
  const isEarliestMonth = React.useMemo(() => {
    if (!earliestDate) return false;
    
    return selectedDate.getFullYear() === earliestDate.getFullYear() &&
           selectedDate.getMonth() === earliestDate.getMonth();
  }, [selectedDate, earliestDate]);

  const handlePanelOpen = (open: boolean) => {
    setIsPanelOpen(open);
    if (!open) {
      setSelectedTransaction(undefined);
    }
  };
  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  return (
    <>
      <div className="flex w-full flex-col lg:flex-row">
        <div className="flex-grow overflow-hidden">
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center sm:gap-0">
              <div className="flex flex-row items-center gap-2">
                <button
                  className={`rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    isEarliestMonth ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  onClick={() =>
                    handleDateChange(
                      new Date(
                        selectedDate.getFullYear(),
                        selectedDate.getMonth() - 1,
                      ),
                    )
                  }
                  disabled={isEarliestMonth}
                >
                  <ChevronLeft size={16} />
                </button>

                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => handleDateChange(date || new Date())}
                  dateFormat="MMMM yyyy"
                  showMonthYearPicker
                  className="w-[150px] bg-transparent text-center text-sm font-medium"
                  renderCustomHeader={({
                    date,
                    decreaseMonth,
                    increaseMonth,
                  }: {
                    date: Date;
                    decreaseMonth: () => void;
                    increaseMonth: () => void;
                  }) => (
                    <div className="flex items-center justify-between">
                      <button
                        onClick={decreaseMonth}
                        disabled={!!earliestDate && date.getFullYear() === earliestDate.getFullYear() && date.getMonth() === earliestDate.getMonth()}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span>{`${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`}</span>
                      <button
                        onClick={increaseMonth}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                        disabled={date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear()}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                  minDate={earliestDate ?? undefined}
                />

                <button
                  className={`rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    selectedDate.getMonth() === new Date().getMonth() && 
                    selectedDate.getFullYear() === new Date().getFullYear() 
                      ? 'opacity-50 cursor-not-allowed' 
                      : ''
                  }`}
                  onClick={() =>
                    handleDateChange(
                      new Date(
                        selectedDate.getFullYear(),
                        selectedDate.getMonth() + 1,
                      ),
                    )
                  }
                  disabled={
                    selectedDate.getMonth() === new Date().getMonth() && 
                    selectedDate.getFullYear() === new Date().getFullYear()
                  }
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                {/* <Button variant="outline" className="w-full sm:w-auto">
                  <Trans i18nKey="common:transactionTabAddToGoalsBtn" />
                </Button>

                <Select>
                  <SelectTrigger
                    className="w-full sm:w-[180px]"
                    id="transaction-type"
                  >
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Add to cash</SelectItem>
                  </SelectContent>
                </Select> */}
              </div>
            </div>

            <div className="overflow-auto">
              <TransactionTable
                onSelectTransaction={setSelectedTransaction}
                onOpenChange={setIsPanelOpen}
                selectedMonth={selectedDate}
              />
            </div>
          </div>
        </div>

        <div className="w-full flex-shrink-0 p-4 lg:w-[300px]">
          <TransactionMonthlyExpenseSummary selectedDate={selectedDate} />
        </div>
      </div>
      {selectedTransaction && (
        <TransactionPanel
          open={isPanelOpen}
          onOpenChange={handlePanelOpen}
          selectedTransaction={selectedTransaction}
          disabledFields={{
            date: true,
            category: false,
            payee: false,
            notes: false,
            amount: true,
            recurring: false,
            account: true,
            attachments: false,
          }}
        />
      )}
    </>
  );
}

export default TransactionTab;
