import * as React from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
    DropdownMenuTrigger
} from "@kit/ui/dropdown-menu";
import {Button} from "@kit/ui/button";
import {Check, ChevronDown} from "lucide-react";

const sampleCategories = {
    "Income": ["Salary", "Investments", "Gifts"],
    "Housing": ["Rent", "Utilities", "Maintenance"],
    "Transportation": ["Car Payment", "Gas", "Public Transit"],
    "Food": ["Groceries", "Dining Out"],
    "Personal": ["Clothing", "Entertainment", "Health"],
    "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT": ["Clothing", "Entertainment", "Health"]
}

interface CategoryCellProps {
    category: {
        parent: string;
        child: string;
    };
    onCategoryChange: (rowId: string, newCategory: { parent: string; child: string }) => void;
    rowId: string;
}

export const CategoryDropdown: React.FC<CategoryCellProps> = ({ category, onCategoryChange, rowId }) => {
    const defaultParent = Object.keys(sampleCategories)[0] as keyof typeof sampleCategories;
    const safeCategory = {
        parent: category?.parent ?? defaultParent,
        child: category?.child ?? sampleCategories[defaultParent][0]
    }

    const handleCategoryChange = (parent: string, child: string) => {
        onCategoryChange(rowId, { parent, child })
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start">
                    <span>{safeCategory.parent} / {safeCategory.child}</span>
                    <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuRadioGroup value={safeCategory.parent}>
                    {Object.entries(sampleCategories).map(([parent, children]) => (
                        <DropdownMenuSub key={parent}>
                            <DropdownMenuSubTrigger>
                                <span>{parent}</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup value={safeCategory.child}>
                                    {children.map((child) => (
                                        <DropdownMenuRadioItem
                                            key={child}
                                            value={child}
                                            onSelect={() => handleCategoryChange(parent, child)}
                                        >
                                            {child}
                                            {safeCategory.parent === parent && safeCategory.child === child && (
                                                <Check className="ml-auto h-4 w-4" />
                                            )}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}