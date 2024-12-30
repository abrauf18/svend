import { useMemo } from 'react';
import { useOnboardingContext } from '~/components/onboarding-context';
import { Database } from '~/lib/database.types';

type Props = {
  transactions: Database['public']['Tables']['fin_account_transactions']['Row'][];
};

export default function useGetParsedCategories({ transactions }: Props) {
  const { state } = useOnboardingContext();

  const categories = state.account.svendCategoryGroups!;

  const parsedCategories = useMemo(() => {
    const categoriesMap: Record<
      string,
      { category: string; categoryGroup: string }
    > = {};

    for (const transaction of transactions) {
      const categoryGroup = Object.values(categories).find((cg) =>
        cg.categories.some((c) => c.id === transaction.svend_category_id),
      );
      const category = categoryGroup?.categories.find(
        (c) => c.id === transaction.svend_category_id,
      );
      categoriesMap[transaction.svend_category_id] = {
        category: category?.name!,
        categoryGroup: categoryGroup?.name!,
      };
    }

    return categoriesMap;
  }, [transactions]);

  return parsedCategories;
}
