import { SupabaseClient, User } from '@supabase/supabase-js';
import { Database } from '~/lib/database.types';
import { CSVRow } from '~/lib/model/onboarding.types';

type Props = {
  supabaseAdmin: SupabaseClient;
  parsedText: CSVRow[];
  userId: string;
};

type Institution =
  Database['public']['Tables']['manual_fin_institutions']['Row'];

type Result = {
  data?: Database['public']['Tables']['manual_fin_institutions']['Row'][];
  error?: any;
  repeatedInstitutions?: Map<string, Institution>;
};

export default async function insertInstitutions({
  supabaseAdmin,
  parsedText,
  userId,
}: Props): Promise<Result> {
  try {
    // Get all current institutions first
    const { data: currentInstitutions, error: currentInstitutionsError } =
      await supabaseAdmin
        .from('manual_fin_institutions')
        .select('*')
        .eq('owner_account_id', userId);

    if (currentInstitutionsError) {
      console.error('[Insert Institutions] Current institutions error:', {
        error: currentInstitutionsError,
        details: currentInstitutionsError.details,
        message: currentInstitutionsError.message
      });
      throw currentInstitutionsError;
    }
    
    if (!currentInstitutions) {
      console.error('[Insert Institutions] No current institutions returned');
      throw new Error('No current institutions were returned');
    }

    // Filter out empty or invalid rows first
    const validRows = parsedText.filter(row => {
      if (!row.BankName?.trim() || !row.BankSymbol?.trim()) {
        console.warn('[Insert Institutions] Skipping row with missing Institution or Symbol:', row);
        return false;
      }
      return true;
    });

    if (validRows.length === 0) {
      throw new Error('CSV file contains no valid data');
    }

    const repeatedInstitutions = new Map<string, Institution>();
    const nonRepeatedInstitutions = new Map<string, CSVRow>();

    for (const trans of validRows) {
      const parsedInstitutionName = trans.BankName.trim().toLowerCase();
      const parsedSymbol = trans.BankSymbol.trim().toUpperCase();

      // Check for name or symbol duplicate in DB - using case-insensitive comparison
      const nameExists = currentInstitutions.find(
        (inst) => (inst.name ?? '').trim().toLowerCase() === parsedInstitutionName
      );

      const symbolExists = currentInstitutions.find(
        (inst) => (inst.symbol ?? '').trim().toUpperCase() === parsedSymbol
      );

      if (nameExists || symbolExists) {
        const existingInst = nameExists || symbolExists;
        repeatedInstitutions.set(
          `${parsedInstitutionName}:${parsedSymbol}`, 
          existingInst
        );
        
        if (nameExists && symbolExists && nameExists.id !== symbolExists.id) {
          // Use the name match as the canonical institution
          repeatedInstitutions.set(`${parsedInstitutionName}:${parsedSymbol}`, nameExists);
        }
      } else {
        // Check for duplicates within new institutions
        const duplicateNameInNew = Array.from(nonRepeatedInstitutions.values()).find(
          (inst) => inst.BankName.trim().toLowerCase() === parsedInstitutionName
        );
        
        const duplicateSymbolInNew = Array.from(nonRepeatedInstitutions.values()).find(
          (inst) => inst.BankSymbol.trim().toUpperCase() === parsedSymbol
        );

        if (duplicateNameInNew || duplicateSymbolInNew) {
          console.warn('[Insert Institutions] Found duplicate in new entries:', {
            name: duplicateNameInNew?.BankName,
            symbol: duplicateSymbolInNew?.BankSymbol,
            existing: Array.from(nonRepeatedInstitutions.values()).map(i => ({
              name: i.BankName,
              symbol: i.BankSymbol
            }))
          });
        } else {
          nonRepeatedInstitutions.set(`${parsedInstitutionName}:${parsedSymbol}`, trans);
        }
      }
    }

    if (nonRepeatedInstitutions.size > 0) {
      const { data, error } = await supabaseAdmin
        .from('manual_fin_institutions')
        .insert([
          ...Array.from(nonRepeatedInstitutions.values()).map((inst) => ({
            owner_account_id: userId,
            name: inst.BankName.trim(),
            symbol: inst.BankSymbol.trim(),
          })),
        ])
        .select();

      if (error) {
        console.error('[Insert Institutions] Insert error:', {
          error,
          details: error.details,
          message: error.message
        });
        throw error;
      }
      if (!data) {
        console.error('[Insert Institutions] No data returned after insert');
        throw new Error('No data returned after institution insert');
      }

      // Need to deduplicate before returning
      const allInstitutions = [...data, ...Array.from(repeatedInstitutions.values())];
      const uniqueInstitutions = Array.from(
        new Map(allInstitutions.map(inst => [inst.id, inst])).values()
      );

      return { data: uniqueInstitutions, repeatedInstitutions };
    } else {
      // If all institutions already exist, just return them (deduped)
      return { 
        data: Array.from(
          new Map(Array.from(repeatedInstitutions.values()).map(inst => [inst.id, inst])).values()
        ),
        repeatedInstitutions
      };
    }
  } catch (err: any) {
    console.error('[Insert Institutions Error]:', {
      error: err,
      message: err.message,
      details: err.details,
      stack: err.stack,
      parsedTextSample: parsedText.slice(0, 2)
    });

    // Return the actual error message for client errors
    return { error: err.message || 'Failed to process institutions' };
  }
}
