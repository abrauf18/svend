import { zodResolver } from '@hookform/resolvers/zod';
import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { ChangeEvent, useState, useRef, useEffect, DragEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useOnboardingContext } from '~/components/onboarding-context';
import CreateInstitution from '../dialogs/institutions/create-institution';
import { manualAccountFormSchema } from '../schemas/account.schema';
import InstitutionsRender from './institutions/institutions-render';
import TransactionSideMenu from './transactions/transaction-side-menu';
import TransactionsRender from './transactions/transactions-render';
import { Button } from '@kit/ui/button';
import { FileUp } from 'lucide-react';
import { Trans } from 'react-i18next';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@kit/ui/accordion';
import CSVGuideDialog from '../dialogs/institutions/upload-csv-guide';
import { toast } from 'sonner';
import CsvColumnsMapperModal from './modals/csv-columns-mapper.modal';
import invalidCsvHandler from './utils/invalid-csv-handler';
import { CSVColumns, CSVState } from '~/lib/model/onboarding.types';
import CSVInvalidRowsModal from './modals/csv-invalid-rows-modal';
import { sanitizeFileName, getUniqueFileName } from '~/lib/utils/csv-naming';

// interface CSVValidationError {
//   isValid: boolean;
//   missingProps: string[];
//   extraProps: string[];
//   invalidRows?: Array<{
//     isValid: boolean;
//     index: number;
//     isValidDate?: boolean;
//     isValidSymbol?: boolean;
//     isValidMask?: boolean;
//   }>;
//   csvData?: any[];
//   error?: Error;
// }

export default function InstitutionsLayout() {
  const { state } = useOnboardingContext();

  const categoryGroups = state.account.svendCategoryGroups!;

  const supabase = getSupabaseBrowserClient();
  const { 
    accountManualInstitutionsAddMany, 
    accountBudgetSetLinkedFinAccounts
  } = useOnboardingContext();

  const [isImportingFile, setIsImportingFile] = useState(false);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isCreatingInstitution, setIsCreatingInstitution] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [csvModalInfo, setCsvModalInfo] = useState<CSVState>({
    isModalOpen: false,
    isRowsModalOpen: false,
    columns: {} as CSVColumns,
    extraColumns: [],
    rawData: [],
    processedData: null,
    invalidRows: undefined,
    csvResult: null,
    error: undefined,
    filename: ''
  });
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);

  const form = useForm<z.infer<typeof manualAccountFormSchema>>({
    resolver: zodResolver(manualAccountFormSchema),
    defaultValues: {
      attachments: [],
    },
  });

  const handleFileUpload = async (file: File) => {
    try {
      setIsImportingFile(true);
      
      const sanitizedName = sanitizeFileName(file.name);
      const uniqueFileName = await getUniqueFileName(sanitizedName);
      setCurrentFileName(uniqueFileName);

      // 1. Upload to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      const filePath = `user/${user!.id}/${uniqueFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('onboarding_attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'text/csv'
        });

      if (uploadError) throw uploadError;

      // 2. Analyze CSV via API
      const res = await fetch('/api/onboarding/account/manual/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filePath })
      });

      const data = await res.json();
      
      if (!res.ok) {
        if (data.missingProps || data.mappableProps) {
          await invalidCsvHandler({ 
            error: data, 
            setIsLearnMoreOpen, 
            setCsvModalInfo,
            filename: filePath
          });
          return;
        }
        throw new Error(data.error || 'Failed to analyze CSV file');
      }

      console.log('[CSV Upload] Response data:', {
        data,
        summary: data.summary,
        institutions: data.institutions?.length,
        linkedAccounts: data.linkedFinAccounts?.length
      });

      const { summary } = data;
      if (summary) {
        const totalNew = summary.newInstitutions + summary.newAccounts + summary.newTransactions;
        console.log('[CSV Upload] Summary:', { summary, totalNew });
        if (totalNew > 0) {
          toast.success(
            `Successfully added:`,
            {
              description: (
                <div className="flex flex-col gap-0.5">
                  {summary.newInstitutions > 0 && (
                    <div><b>{summary.newInstitutions}</b> institutions</div>
                  )}
                  {summary.newAccounts > 0 && (
                    <div><b>{summary.newAccounts}</b> accounts</div>
                  )}
                  {summary.newTransactions > 0 && (
                    <div><b>{summary.newTransactions}</b> transactions</div>
                  )}
                </div>
              )
            }
          );
        } else {
          toast.warning('No new data was added from the CSV file');
        }
      }

      // add institutions to context
      if (data.institutions) {
        accountManualInstitutionsAddMany(data.institutions);
      }

      // update linked accounts in budget
      if (data.linkedFinAccounts) {
        accountBudgetSetLinkedFinAccounts(data.linkedFinAccounts);
      }
    } catch (err) {
      console.error('CSV Upload Error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to process CSV file');
    } finally {
      setIsImportingFile(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtTop = target.scrollTop <= 1;
    const distanceFromBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;

    requestAnimationFrame(() => {
      target.style.setProperty('--mask-top', isAtTop ? '0' : '20px');
      target.style.setProperty(
        '--mask-bottom',
        distanceFromBottom <= 1 ? '0' : '20px',
      );
    });
  };

  useEffect(() => {
    const container = document.querySelector(
      '.institutions-scroll-container',
    ) as HTMLElement;
    if (container) {
      container.style.setProperty('--mask-top', '0');
      container.style.setProperty('--mask-bottom', '20px');

      // Trigger initial scroll handler to set up masks correctly
      handleScroll({
        currentTarget: container,
      } as React.UIEvent<HTMLDivElement>);
    }
  }, []);

  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = ref.current;
    const handleCancel = () => setIsImportingFile(false);

    input?.addEventListener('cancel', handleCancel);
    return () => input?.removeEventListener('cancel', handleCancel);
  }, []);

  const handleDownloadSample = () => {
    const sampleData =
      'TransactionId,TransactionStatus,TransactionDate,TransactionAmount,TransactionMerchant,TransactionCategory,BankName,BankSymbol,AccountName,AccountType,AccountMask\n' +
      'BOA202401010002,POSTED,01/01/2024,-1000.00,Starting Balance,Income,Bank of America,BOA,Svend Checking,DEPOSITORY,1234\n' +
      'BOA202401010001,POSTED,01/02/2024,-3500.00,ABC Company,Income,Bank of America,BOA,Svend Checking,DEPOSITORY,1234\n' +
      'BOA202401010003,POSTED,01/03/2024,2000.00,Rent Payment,Rent,Bank of America,BOA,Svend Checking,DEPOSITORY,1234\n' +
      'BOA202401010004,POSTED,01/02/2024,89.99,Whole Foods,Groceries,Bank of America,BOA,Svend Credit,CREDIT,5678\n' +
      'BOA202401010005,POSTED,01/05/2024,14.99,Netflix,TV & Movies,Bank of America,BOA,Svend Credit,CREDIT,5678';

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'svend-manual-fin-sample.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (isCreatingInstitution) {
      // Wait for next frame to ensure skeleton is rendered
      requestAnimationFrame(() => {
        // Add a small delay for smoother transition
        setTimeout(() => {
          const skeletonElement = document.querySelector(
            '.plaid-connection-skeleton',
          );
          if (skeletonElement) {
            skeletonElement.scrollIntoView({
              behavior: 'smooth',
              block: 'end',
            });
          }
        }, 100);
      });
    }
  }, [isCreatingInstitution]);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await handleFileUpload(file);
      // Also reset the file input if it exists
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        (fileInput as HTMLInputElement).value = '';
      }
    }
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await handleFileUpload(file);
      // Reset the input value so the same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-full w-full">
        {/* Left side - Institutions */}
        <div className="flex h-full w-[432px] flex-shrink-0 flex-col">
          {/* Scrollable Content including Accordion */}
          <div className="flex-1 overflow-y-auto">
            <div
              onScroll={handleScroll}
              className="institutions-scroll-container scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 h-[calc(99vh-480px)] overflow-y-auto pr-4 [mask-image:linear-gradient(to_bottom,transparent,black_var(--mask-top,20px),black_calc(100%-20px),transparent)]"
            >
              <div className="flex flex-col gap-2 pb-6">
                {/* Accordion moved inside scroll container */}
                <Accordion type="single" collapsible defaultValue="manual">
                  <AccordionItem value="manual">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-shrink-0 px-2">
                        <AccordionTrigger className="flex h-10 items-center justify-center rounded-md border-[2px] border-primary bg-background py-2 pl-6 pr-5 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                          <Trans
                            i18nKey={
                              'onboarding:connectManualAccountsSetupOptionsTitleText'
                            }
                          />
                          &nbsp;&nbsp;
                        </AccordionTrigger>
                      </div>
                      <div className="flex-1 text-xs text-muted-foreground">
                        <Trans
                          i18nKey={
                            'onboarding:connectManualAccountsInstructionText'
                          }
                        />
                      </div>
                    </div>
                    <div className="my-4 flex-shrink-0">
                      <AccordionContent
                        className={`rounded-lg border-[2px] border-primary p-2 ${
                          isDragging ? 'border-dashed bg-primary/5' : ''
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <div className="px-4">
                          <div className="my-2 flex flex-col gap-2">
                            <div className="text-sm font-medium text-foreground">
                              <Trans
                                i18nKey={
                                  'onboarding:connectManualAccountsUploadCSVTitleText'
                                }
                              />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <Trans
                                i18nKey={
                                  'onboarding:connectManualAccountsUploadCSVInstructionText'
                                }
                              />
                              {'. '}
                              <Trans
                                i18nKey={
                                  'onboarding:connectManualAccountsUploadCSVSeeOurText'
                                }
                              />
                              &nbsp;
                              <CSVGuideDialog
                                isOpen={isLearnMoreOpen}
                                onOpenChange={setIsLearnMoreOpen}
                                isCategoriesOpen={isCategoriesOpen}
                                setIsCategoriesOpen={setIsCategoriesOpen}
                                categoryGroups={categoryGroups}
                                handleDownloadSample={handleDownloadSample}
                              />
                            </div>
                            <div className="mb-4 flex gap-2 p-2">
                              <Button
                                className="w-fit"
                                onClick={() => ref.current?.click()}
                              >
                                <FileUp className="mr-2 size-5" />
                                <Trans
                                  i18nKey={
                                    'onboarding:connectManualUploadCSVButtonLabel'
                                  }
                                />
                              </Button>
                              <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileInputChange}
                                ref={ref}
                                className="hidden"
                              />
                              <div
                                className={`flex items-center rounded-md border border-dashed border-muted-foreground/50 px-3 py-2 text-xs text-muted-foreground ${isDragging ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground hover:bg-muted/50'} transition-colors duration-200`}
                              >
                                <Trans
                                  i18nKey={
                                    'onboarding:connectManualUploadCSVDragLabel'
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="text-sm font-medium text-foreground">
                              <Trans
                                i18nKey={
                                  'onboarding:connectManualAccountsEditorTitleText'
                                }
                              />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <Trans
                                i18nKey={
                                  'onboarding:connectManualAccountsEditorInstructionText'
                                }
                              />
                            </div>
                            <div className="flex gap-2 p-2">
                              <CreateInstitution
                                setIsCreatingInstitution={
                                  setIsCreatingInstitution
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                </Accordion>

                {/* Institutions Render */}
                <InstitutionsRender
                  isImportingFile={isImportingFile}
                  isCreatingInstitution={isCreatingInstitution}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Transactions */}
        <div className="h-full flex-1 pl-4">
          <TransactionsRender />
          <TransactionSideMenu />
        </div>
      </div>
      <CsvColumnsMapperModal
        csvModalInfo={csvModalInfo}
        setCsvModalInfo={setCsvModalInfo}
      />
      <CSVInvalidRowsModal
        csvModalInfo={csvModalInfo}
        setCsvModalInfo={setCsvModalInfo}
      />
    </div>
  );
}
