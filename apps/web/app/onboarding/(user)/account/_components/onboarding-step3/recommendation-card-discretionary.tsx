import { Trans } from '@kit/ui/trans';

export interface DiscretionarySavingsRecommendation {
  currentSpending: number;
  potentialSavings: number;
}

interface RecommendationCardDiscretionaryProps {
  recommendation: DiscretionarySavingsRecommendation;
}

export function RecommendationCardDiscretionary({ recommendation }: RecommendationCardDiscretionaryProps) {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount));

  const values = {
    current: formatCurrency(recommendation.currentSpending),
    savings: formatCurrency(recommendation.potentialSavings)
  };

  return (
    <div className="flex-1 min-w-[250px] max-w-[250px] h-48 p-4 border rounded-lg">
      <h4 className="font-bold mb-2">
        Budget Recommendation
      </h4>
      <p className="text-xs text-muted-foreground py-2">
        We detected that you spend <span className="font-semibold">{values.current}</span> per month on discretionary purchases.
      </p>
      <p className="text-sm">
        You could save up to <span className="font-bold">{values.savings}</span> by reducing your discretionary spending by 50%
      </p>
    </div>
  );
}
