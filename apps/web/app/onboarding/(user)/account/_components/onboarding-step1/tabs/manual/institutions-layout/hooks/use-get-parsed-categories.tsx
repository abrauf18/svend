import { useMemo } from 'react';
import { useOnboardingContext } from '~/components/onboarding-context';
import { FinAccountTransaction } from '~/lib/model/fin.types';

type Props = {
  transactions: FinAccountTransaction[];
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
      if (!transaction.svendCategoryId) continue;
      
      const categoryGroup = Object.values(categories).find((cg) =>
        cg.categories.some((c) => c.id === transaction.svendCategoryId),
      );
      const category = categoryGroup?.categories.find(
        (c) => c.id === transaction.svendCategoryId,
      );

      if (categoryGroup && category) {
        categoriesMap[transaction.svendCategoryId] = {
          category: category.name,
          categoryGroup: categoryGroup.name,
        };
      }
    }

    return categoriesMap;
  }, [transactions, categories]);

  return parsedCategories;
}
