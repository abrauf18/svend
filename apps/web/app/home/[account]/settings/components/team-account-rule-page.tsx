'use client';

import { useState } from 'react';
import { Button } from '@kit/ui/button';
import { PlusCircle, Eye, Trash2, MoreVertical, Copy, GripVertical } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@kit/ui/dialog';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { RuleForm, type RuleFormValues } from './rule-form';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { ViewRuleModal } from './view-rule-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@kit/ui/dropdown-menu";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BudgetRule } from '~/lib/model/budget.types';

interface RuleItem {
  enabled: boolean;
  [key: string]: unknown;
}

const countEnabledItems = (items: Record<string, RuleItem>) => {
  return Object.values(items).filter(item => item.enabled === true).length;
};

interface SortableRuleCardProps {
  rule: BudgetRule;
  onView: (rule: BudgetRule) => void;
  onDelete: (ruleId: string) => void;
  onDuplicate: (rule: BudgetRule) => void;
}

function SortableRuleCard({ rule, onView, onDelete, onDuplicate }: SortableRuleCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card ref={setNodeRef} style={style} className='max-w-[700px] w-full'>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            className="cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </button>
          <div>
            <CardTitle>{rule.name}</CardTitle>
            <p className="text-sm text-gray-500">
              {rule.isActive ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(rule)}
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">View</span>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => onDuplicate(rule)}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(rule.id)}
                className="flex items-center gap-2 text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
          <div className="mb-2">
            <strong>Conditions:</strong> {countEnabledItems(rule.conditions as Record<string, RuleItem>)} active
          </div>
          <div>
            <strong>Actions:</strong> {countEnabledItems(rule.actions as Record<string, RuleItem>)} active
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TeamAccountRulesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { workspace, updateBudgetRuleOrder, deleteBudgetRule } = useBudgetWorkspace();
  
  const linkedAccounts = workspace?.budget?.linkedFinAccounts ?? [];
  
  const budgetId = workspace?.budget?.id;
  const filteredCategories = Object.values(workspace.budgetCategories).filter(category => 
    category.name !== budgetId
  );
  const tags = workspace?.budgetTags;
  const rules = workspace?.budgetRules || [];
  const [selectedRule, setSelectedRule] = useState<BudgetRule | null>(null);
  const [ruleToDuplicate, setRuleToDuplicate] = useState<RuleFormValues | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = rules.findIndex((rule) => rule.id === active.id);
    const newIndex = rules.findIndex((rule) => rule.id === over.id);

    const newRules = arrayMove(rules, oldIndex, newIndex);
    const newRuleOrder = newRules.map(rule => rule.id);
    
    // Store the original order for potential rollback
    const originalRuleOrder = rules.map(rule => rule.id);
    
    // Optimistically update the UI
    updateBudgetRuleOrder(newRuleOrder);

    try {
      const response = await fetch(`/api/budgets/${budgetId}/rules`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ruleOrders: newRuleOrder,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update rule order');
      }

      toast.success('Rule order updated');
    } catch (error) {
      console.error('Error updating rule order:', error);
      // Rollback to original order if the API call fails
      updateBudgetRuleOrder(originalRuleOrder);
      toast.error('Failed to update rule order');
    }
  };

  const handleDeleteRule = (ruleId: string) => {
    setDeleteRuleId(ruleId);
  };

  const confirmDelete = async () => {
    if (!deleteRuleId || !workspace.budget?.id) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/budgets/${workspace.budget.id}/rules/${deleteRuleId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete rule');
      }

      deleteBudgetRule(deleteRuleId);
      toast.success('Rule deleted successfully');
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete rule');
    } finally {
      setIsDeleting(false);
      setDeleteRuleId(null);
    }
  };

  const handleDuplicateRule = (rule: BudgetRule) => {
    const formValues: RuleFormValues = {
      name: `${rule.name} (Copy)`,
      criteria: {
        merchantName: {
          enabled: rule.conditions?.merchantName?.enabled ?? false,
          matchType: rule.conditions?.merchantName?.matchType ?? 'contains',
          value: rule.conditions?.merchantName?.value,
        },
        amount: {
          enabled: rule.conditions?.amount?.enabled ?? false,
          matchType: rule.conditions?.amount?.matchType ?? 'exactly',
          value: rule.conditions?.amount?.value?.toString(),
          rangeStart: rule.conditions?.amount?.rangeStart?.toString(),
          rangeEnd: rule.conditions?.amount?.rangeEnd?.toString(),
        },
        date: {
          enabled: rule.conditions?.date?.enabled ?? false,
          matchType: rule.conditions?.date?.matchType ?? 'exactly',
          value: rule.conditions?.date?.value ? Number(rule.conditions.date.value) : undefined,
          rangeStart: rule.conditions?.date?.rangeStart ? Number(rule.conditions.date.rangeStart) : undefined,
          rangeEnd: rule.conditions?.date?.rangeEnd ? Number(rule.conditions.date.rangeEnd) : undefined,
        },
        account: {
          enabled: rule.conditions?.account?.enabled ?? false,
          value: rule.conditions?.account?.value,
        },
      },
      actions: {
        renameMerchant: rule.actions?.renameMerchant ?? { enabled: false },
        setNote: rule.actions?.setNote ?? { enabled: false },
        setCategory: rule.actions?.setCategory ?? { enabled: false },
        addTags: {
          enabled: rule.actions?.addTags?.enabled ?? false,
          value: rule.actions?.addTags?.value ?? []
        },
      },
      isAppliedToAllTransactions: false,
    };
    
    setRuleToDuplicate(formValues);
    setIsModalOpen(true);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex justify-center items-center">
        <Button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          Create New Rule
        </Button>
      </div>

      {rules.length > 0 ? (
        <div className="space-y-4 flex justify-center w-full flex-col items-center">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rules.map(rule => rule.id)}
              strategy={verticalListSortingStrategy}
            >
              {rules.map((rule) => (
                <SortableRuleCard
                  key={rule.id}
                  rule={rule}
                  onView={setSelectedRule}
                  onDelete={handleDeleteRule}
                  onDuplicate={handleDuplicateRule}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h3 className="mt-2 text-sm font-semibold">No rules created</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new transaction rule
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog 
        open={isModalOpen} 
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setRuleToDuplicate(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{ruleToDuplicate ? 'Duplicate Rule' : 'Create New Rule'}</DialogTitle>
          </DialogHeader>
          <RuleForm
            accounts={linkedAccounts
              .filter(acc => acc.budgetFinAccountId)
              .map(acc => ({
                budgetFinAccountId: acc.budgetFinAccountId!,
                name: acc.name,
                balance: acc.balance || 0,
                institutionName: acc.institutionName,
                mask: acc.mask
              }))}
            tags={tags}
            categories={filteredCategories}
            onClose={() => {
              setIsModalOpen(false);
              setRuleToDuplicate(null);
            }}
            budgetId={budgetId}
            initialValues={ruleToDuplicate ?? undefined}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteRuleId} onOpenChange={(open) => !open && setDeleteRuleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this rule? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteRuleId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          
      {selectedRule && (
        <ViewRuleModal
          isOpen={!!selectedRule}
          onClose={() => setSelectedRule(null)}
          categories={filteredCategories}
          accounts={linkedAccounts
            .filter(acc => acc.budgetFinAccountId)
            .map(acc => ({
              budgetFinAccountId: acc.budgetFinAccountId!,
              name: acc.name,
              balance: acc.balance || 0,
              institutionName: acc.institutionName,
              mask: acc.mask
            }))}
          rule={{
            ...selectedRule,
            isActive: selectedRule.isActive,
            conditions: selectedRule.conditions,
            actions: selectedRule.actions
          }}
          budgetTags={tags ?? []}
        />
      )}
    </div>
  );
}
