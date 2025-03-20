import { Button } from '@kit/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@kit/ui/dialog";
import { Trans } from '@kit/ui/trans';
import { Download, Info } from 'lucide-react';
import { BudgetCategoryGroups } from '~/lib/model/budget.types';

interface CSVGuideDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isCategoriesOpen: boolean;
  setIsCategoriesOpen: (open: boolean) => void;
  categoryGroups: BudgetCategoryGroups;
  handleDownloadSample: () => void;
}

export default function CSVGuideDialog({ 
  isOpen, 
  onOpenChange, 
  isCategoriesOpen, 
  setIsCategoriesOpen,
  categoryGroups,
  handleDownloadSample 
}: CSVGuideDialogProps) {
  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={onOpenChange}
    >
      <DialogTrigger asChild>
        <button className="text-primary hover:underline">
          <Trans i18nKey={'onboarding:connectManualAccountsUploadCSVImportGuideText'} />
        </button>
      </DialogTrigger>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>CSV Upload Guide</DialogTitle>
          <DialogDescription>
            Format your CSV file with the following columns
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          <ul className="list-disc pl-4 space-y-2">
            <li><span className="font-bold">TransactionId</span> (globally unique identifier)</li>
            <li><span className="font-bold">TransactionStatus</span> (PENDING or POSTED)</li>
            <li><span className="font-bold">TransactionDate</span> (MM/DD/YYYY format)</li>
            <li><span className="font-bold">TransactionAmount</span> (positive for expenses, negative for income/credits)</li>
            <li><span className="font-bold">TransactionMerchant</span> (name of the merchant/payee)</li>
            <li><span className="font-bold">TransactionCategory</span> (a supported category name)
              <Dialog open={isCategoriesOpen} onOpenChange={setIsCategoriesOpen}>
                <DialogTrigger asChild>
                  <button className="rounded-full bg-muted p-1 text-muted-foreground hover:bg-muted/80 translate-y-[3px] mx-1">
                    <Info className="size-4" />
                  </button>
                </DialogTrigger>
                <DialogContent 
                  className="sm:max-w-[425px]"
                  onInteractOutside={(e) => e.preventDefault()}
                >
                  <DialogHeader>
                    <DialogTitle>Available Categories</DialogTitle>
                  </DialogHeader>
                  <div 
                    className="relative max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <div className="select-none">
                      {categoryGroups && Object.entries(categoryGroups).map(([groupId, group]) => (
                        <div key={groupId} className="mb-2">
                          <div className="px-2 text-sm text-muted-foreground pointer-events-none">
                            {group.name}
                          </div>
                          <div className="space-y-1 p-2">
                            {group.categories.map((category) => (
                              <div
                                key={category.id}
                                className="flex items-center rounded-sm py-1.5 px-2 text-sm pointer-events-none"
                              >
                                <span className="truncate">
                                  {category.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </li>
            <li><span className="font-bold">BankName</span> (name of the financial institution)</li>
            <li><span className="font-bold">BankSymbol</span> (unique 3-5 letter code, e.g., BOA)</li>
            <li><span className="font-bold">AccountName</span> (name of the account)</li>
            <li><span className="font-bold">AccountType</span> (DEPOSITORY, CREDIT, LOAN, INVESTMENT, or OTHER)</li>
            <li><span className="font-bold">AccountMask</span> (last 4 digits of account number)</li>
          </ul>
          <Button 
            variant="outline" 
            className="w-full mt-4"
            onClick={() => {
              handleDownloadSample();
              onOpenChange(false);
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Sample CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 