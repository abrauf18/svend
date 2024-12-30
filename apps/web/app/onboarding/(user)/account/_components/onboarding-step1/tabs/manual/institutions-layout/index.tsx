import { zodResolver } from '@hookform/resolvers/zod';
import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { ChangeEvent, useState, useRef, useEffect, DragEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import parseCSVResponse from '~/api/onboarding/account/manual/csv/[filename]/_utils/parse-csv-response';
import { useOnboardingContext } from '~/components/onboarding-context';
import { getUniqueFileName } from '~/utils/get-unique-filename';
import { sanitizeFileName } from '~/utils/sanitize-filename';
import CreateInstitution from '../dialogs/institutions/create-institution';
import { manualAccountFormSchema } from '../schemas/account.schema';
import InstitutionsRender from './institutions/institutions-render';
import TransactionSideMenu from './transactions/transaction-side-menu';
import TransactionsRender from './transactions/transactions-render';
import { Button } from '@kit/ui/button';
import { FileUp } from 'lucide-react';
import { Trans } from 'react-i18next';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@kit/ui/accordion";
import CSVGuideDialog from '../dialogs/institutions/upload-csv-guide';

export default function InstitutionsLayout() {
  
  const { state } = useOnboardingContext();
  
  const categoryGroups = state.account.svendCategoryGroups!;
  
  const supabase = getSupabaseBrowserClient();
  const { accountManualInstitutionsAddMany } = useOnboardingContext();
  
  const [isImportingFile, setIsImportingFile] = useState(false);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isCreatingInstitution, setIsCreatingInstitution] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const form = useForm<z.infer<typeof manualAccountFormSchema>>({
    resolver: zodResolver(manualAccountFormSchema),
    defaultValues: {
      attachments: [],
    },
  });

  const { watch, setValue } = form;

  const uploadFilesToStorage = async (attachments: (File | string)[]) => {
    const uploadedFileNames = [];

    const { data } = await supabase.auth.getUser();

    try {
      for (const attachment of attachments) {
        // Skip if attachment is already a filename string
        if (typeof attachment === 'string') {
          uploadedFileNames.push(attachment);
          continue;
        }

        const file = attachment;
        const sanitizedFileName = sanitizeFileName(file.name);
        const filePath = `user/${data.user?.id}/${sanitizedFileName}`;

        const { error } = await supabase.storage
          .from('onboarding_attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          console.error('Error uploading file:', error.message);
          throw error;
        }

        // Store just the filePath instead of full URL
        uploadedFileNames.push(filePath);
      }

      return uploadedFileNames;
    } catch (error: unknown) {
      console.error(
        'Error during file upload:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return [];
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        setIsImportingFile(false);
        return;
      }

      const currentAttachments = watch('attachments');

      const sanitizedName = sanitizeFileName(event.target.files[0]!.name);
      const uniqueName = `${getUniqueFileName(sanitizedName, currentAttachments)}-${crypto.randomUUID()}`;

      const newFile = new (File as any)([event.target.files[0]!], uniqueName, {
        type: event.target.files[0]!.type,
      });

      setValue('attachments', [...currentAttachments, newFile]);
      await uploadFilesToStorage([newFile]);

      const { institutions, error } = await fetch(
        `/api/onboarding/account/manual/csv/${uniqueName}`,
        {
          method: 'POST',
        },
      ).then<{
        institutions?: ReturnType<typeof parseCSVResponse>;
        error?: string;
      }>((res) => res.json());

      if (error) throw new Error(error);
      if (!institutions)
        throw new Error('No institutions were returned from server');

      accountManualInstitutionsAddMany(institutions);
      setIsImportingFile(false);
    } catch (err: any) {
      console.error('CSV upload error:', err);
      if (err.response) {
        const errorText = await err.response.text();
        console.error('Server error details:', errorText);
      }
      setIsImportingFile(false);
    }

    if (event.target) {
      event.target.value = '';
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtTop = target.scrollTop <= 1;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    
    requestAnimationFrame(() => {
      target.style.setProperty('--mask-top', isAtTop ? '0' : '20px');
      target.style.setProperty('--mask-bottom', distanceFromBottom <= 1 ? '0' : '20px');
    });
  };

  useEffect(() => {
    const container = document.querySelector('.institutions-scroll-container') as HTMLElement;
    if (container) {
      container.style.setProperty('--mask-top', '0');
      container.style.setProperty('--mask-bottom', '20px');
      
      // Trigger initial scroll handler to set up masks correctly
      handleScroll({ currentTarget: container } as React.UIEvent<HTMLDivElement>);
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
    const sampleData = 'TransactionId,Date,Amount,Merchant,Category,BankName,BankSymbol,AccountName,AccountType,AccountMask\n' +
                      'BOA202401010002,01/01/2024,-1000.00,Starting Balance,Income,Bank of America,BOA,Svend Checking,DEPOSITORY,1234\n' +
                      'BOA202401010001,01/02/2024,-3500.00,ABC Company,Income,Bank of America,BOA,Svend Checking,DEPOSITORY,1234\n' +
                      'BOA202401010003,01/03/2024,2000.00,Rent Payment,Rent,Bank of America,BOA,Svend Checking,DEPOSITORY,1234\n' +
                      'BOA202401010004,01/02/2024,89.99,Whole Foods,Groceries,Bank of America,BOA,Svend Credit,CREDIT,5678\n' +
                      'BOA202401010005,01/05/2024,14.99,Netflix,TV & Movies,Bank of America,BOA,Svend Credit,CREDIT,5678';
    
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
          const skeletonElement = document.querySelector('.plaid-connection-skeleton');
          if (skeletonElement) {
            skeletonElement.scrollIntoView({ 
              behavior: 'smooth',
              block: 'end'
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

    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));

    if (csvFile) {
      setIsImportingFile(true);
      const event = {
        target: {
          files: [csvFile],
          value: ''
        }
      } as unknown as ChangeEvent<HTMLInputElement>;
      
      await handleFileUpload(event);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-full w-full flex">
        {/* Left side - Institutions */}
        <div className="h-full w-[432px] flex-shrink-0 flex flex-col">
          {/* Scrollable Content including Accordion */}
          <div className="flex-1 overflow-y-auto">
            <div 
              onScroll={handleScroll}
              className="institutions-scroll-container h-[calc(99vh-480px)] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 pr-4 [mask-image:linear-gradient(to_bottom,transparent,black_var(--mask-top,20px),black_calc(100%-20px),transparent)]"
            >
              <div className="flex flex-col gap-2 pb-6">
                {/* Accordion moved inside scroll container */}
                <Accordion type="single" collapsible defaultValue="manual">
                  <AccordionItem value="manual">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-shrink-0 px-2">
                        <AccordionTrigger className="flex h-10 items-center justify-center rounded-md border border-primary border-[2px] bg-background pl-6 pr-5 py-2 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                          <Trans i18nKey={'onboarding:connectManualAccountsSetupOptionsTitleText'} />&nbsp;&nbsp;
                        </AccordionTrigger>
                      </div>
                      <div className="text-xs text-muted-foreground flex-1">
                        <Trans i18nKey={'onboarding:connectManualAccountsInstructionText'} />
                      </div>
                    </div>
                    <div className="flex-shrink-0 my-4">
                      <AccordionContent 
                        className={`border border-primary border-[2px] rounded-lg p-2 ${
                          isDragging ? 'bg-primary/5 border-dashed' : ''
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <div className="px-4">
                          <div className="flex flex-col gap-2 my-2">
                            <div className="text-sm text-foreground font-medium">
                              <Trans i18nKey={'onboarding:connectManualAccountsUploadCSVTitleText'} />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <Trans i18nKey={'onboarding:connectManualAccountsUploadCSVInstructionText'} />{'. '}
                              <Trans i18nKey={'onboarding:connectManualAccountsUploadCSVSeeOurText'} />&nbsp;
                              <CSVGuideDialog 
                                isOpen={isLearnMoreOpen}
                                onOpenChange={setIsLearnMoreOpen}
                                isCategoriesOpen={isCategoriesOpen}
                                setIsCategoriesOpen={setIsCategoriesOpen}
                                categoryGroups={categoryGroups}
                                handleDownloadSample={handleDownloadSample}
                              />
                            </div>
                            <div className="flex gap-2 p-2 mb-4">
                              <Button className="w-fit" onClick={() => ref.current?.click()}>
                                <FileUp className="size-5 mr-2" />
                                <Trans i18nKey={'onboarding:connectManualUploadCSVButtonLabel'} />
                              </Button>
                              <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                ref={ref}
                                onClick={() => setIsImportingFile(true)}
                                className="hidden"
                              />
                              <div className={`
                                text-xs text-muted-foreground flex items-center
                                px-3 py-2 rounded-md border border-dashed border-muted-foreground/50
                                ${isDragging ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50 hover:border-muted-foreground'}
                                transition-colors duration-200
                              `}>
                                <Trans i18nKey={'onboarding:connectManualUploadCSVDragLabel'} />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="text-sm text-foreground font-medium">
                              <Trans i18nKey={'onboarding:connectManualAccountsEditorTitleText'} />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <Trans i18nKey={'onboarding:connectManualAccountsEditorInstructionText'} />
                            </div>
                            <div className="flex gap-2 p-2">
                              <CreateInstitution setIsCreatingInstitution={setIsCreatingInstitution} />
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
    </div>
  );
}
