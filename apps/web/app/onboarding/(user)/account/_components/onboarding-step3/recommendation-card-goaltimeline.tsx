import { Trans } from '@kit/ui/trans';

export interface GoalTimelineRecommendation {
  currentTimeline: number; // in months
  adjustedTimeline: number; // in months
  monthlyAdjustment: number; // dollar amount
  requiresSpendingReduction: boolean;
  availableFunds: number; // monthly available funds after spending
  goalType: string;
}

interface RecommendationCardGoalTimelineProps {
  recommendation: GoalTimelineRecommendation;
}

export function RecommendationCardGoalTimeline({ recommendation }: RecommendationCardGoalTimelineProps) {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount));
  
  const formatMonths = (months: number) => {
    return months === 1 ? '1 month' : `${months} months`;
  };

  const values = {
    current: formatMonths(recommendation.currentTimeline),
    adjusted: formatMonths(recommendation.adjustedTimeline),
    adjustment: formatCurrency(recommendation.monthlyAdjustment),
    availableFunds: formatCurrency(recommendation.availableFunds)
  };

  return (
    <div className="flex-1 min-w-[250px] max-w-[250px] h-48 p-4 border rounded-lg">
      <h4 className="font-bold mb-2">
        Goal Recommendation
      </h4>
      <p className="text-xs text-muted-foreground py-2">
        Your current <i>{recommendation.goalType}</i> goal timeline is <span className="font-semibold">{values.current}</span>{!recommendation.requiresSpendingReduction ? <> and your monthly savings totals <span className="font-bold">{values.availableFunds}</span></> : null}.
      </p>
      <p className="text-sm">
        {recommendation.requiresSpendingReduction ? (
          <>By reducing your monthly spending by <span className="font-bold">{values.adjustment}</span>, you could reach your goal in <span className="font-bold">{values.adjusted}</span></>
        ) : (
          <>If you reduce your monthly savings by <span className="font-bold">{values.adjustment}</span> you can reach your goal in <span className="font-bold">{values.adjusted}</span>.</>
        )}
      </p>
    </div>
  );
}
