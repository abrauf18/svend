'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import { CategoryGroup } from '~/lib/model/fin.types';
import { Badge } from '@kit/ui/badge';
import { Card, CardContent } from '@kit/ui/card';
import { BudgetRule } from '~/lib/model/budget.types';

export interface ViewRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryGroup[];
  accounts: Array<{
    budgetFinAccountId: string;
    name: string;
    balance: number;
    institutionName: string;
    mask: string;
  }>;
  rule: BudgetRule;
  budgetTags: Array<{ id: string; name: string }>;
}

export function ViewRuleModal({ isOpen, onClose, rule, categories, accounts, budgetTags }: ViewRuleModalProps) {
  const getCategoryName = (categoryId: string) => {
    for (const group of categories) {
      const category = group.categories.find(cat => cat.id === categoryId);
      if (category) {
        return category.name;
      }
    }
    return categoryId;
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(acc => acc.budgetFinAccountId === accountId);
    if (!account) return accountId;
    
    return `${account.institutionName} - ${account.name} - ***${account.mask} - $${account.balance.toFixed(2)}`;
  };

  const getTagName = (tagId: string) => {
    return budgetTags.find(tag => tag.id === tagId)?.name ?? tagId;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{rule.name}</DialogTitle>
          <div className="flex gap-2 mt-2">
            <Badge variant={rule.isActive ? "success" : "secondary"}>
              {rule.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">When a transaction matches:</h3>
              <div className="space-y-4 pl-4">
                {rule.conditions.merchantName?.enabled && (
                  <div className="flex items-start gap-4">
                    <Badge variant="outline" className="mt-1 min-w-[120px] justify-center">Merchant Name</Badge>
                    <div>
                      <p className="font-medium">
                        {rule.conditions.merchantName.matchType === 'contains' ? 'Contains' : 'Exactly matches'}
                      </p>
                      <p className="text-muted-foreground">&quot;{rule.conditions.merchantName.value}&quot;</p>
                    </div>
                  </div>
                )}

                {rule.conditions.amount?.enabled && (
                  <div className="flex items-start gap-4">
                    <Badge variant="outline" className="mt-1 min-w-[120px] justify-center">Amount</Badge>
                    <div>
                      <p className="font-medium">
                        {rule.conditions.amount.matchType === 'exactly' ? 'Exactly' : 'Between'}
                      </p>
                      <p className="text-muted-foreground">
                        {rule.conditions.amount.matchType === 'exactly'
                          ? `$${rule.conditions.amount.value}`
                          : `$${rule.conditions.amount.rangeStart} - $${rule.conditions.amount.rangeEnd}`}
                      </p>
                    </div>
                  </div>
                )}

                {rule.conditions.date?.enabled && (
                  <div className="flex items-start gap-4">
                    <Badge variant="outline" className="mt-1 min-w-[120px] justify-center">Date</Badge>
                    <div>
                      <p className="font-medium">
                        {rule.conditions.date.matchType === 'exactly' ? 'On day' : 'Between days'}
                      </p>
                      <p className="text-muted-foreground">
                        {rule.conditions.date.matchType === 'exactly'
                          ? rule.conditions.date.value
                          : `${rule.conditions.date.rangeStart} - ${rule.conditions.date.rangeEnd}`}
                      </p>
                    </div>
                  </div>
                )}

                {rule.conditions.account?.enabled && (
                  <div className="flex items-start gap-4">
                    <Badge variant="outline" className="mt-1 min-w-[120px] justify-center">Account</Badge>
                    <p className="text-muted-foreground">
                      {getAccountName(rule.conditions.account.value ?? '')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Then apply these changes:</h3>
              <div className="space-y-4 pl-4">
                {rule.actions.renameMerchant?.enabled && (
                  <div className="flex items-start gap-4">
                    <Badge variant="outline" className="mt-1 min-w-[120px] justify-center">Rename merchant to</Badge>
                    <p className="text-muted-foreground">{rule.actions.renameMerchant.value}</p>
                  </div>
                )}

                {rule.actions.setNote?.enabled && (
                  <div className="flex items-start gap-4">
                    <Badge variant="outline" className="mt-1 min-w-[120px] justify-center">Set note</Badge>
                    <p className="text-muted-foreground">{rule.actions.setNote.value}</p>
                  </div>
                )}

                {rule.actions.setCategory?.enabled && (
                  <div className="flex items-start gap-4">
                    <Badge variant="outline" className="mt-1 min-w-[120px] justify-center">Set category</Badge>
                    <p className="text-muted-foreground">{getCategoryName(rule.actions.setCategory.value ?? '')}</p>
                  </div>
                )}

                {rule.actions.addTags?.enabled && (
                  <div className="flex items-start gap-4">
                    <Badge variant="outline" className="mt-1 min-w-[120px] justify-center">Set tags</Badge>
                    <div className="flex flex-wrap gap-1">
                      {rule.actions.addTags.value?.map(tagId => (
                        <Badge key={tagId} variant="secondary">{getTagName(tagId)}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
} 