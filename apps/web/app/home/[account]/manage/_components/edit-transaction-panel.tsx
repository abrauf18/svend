"use client"

import * as React from "react"
import { Calendar, Upload, X } from "lucide-react"
import { Button } from "@kit/ui/button"
import { Calendar as CalendarComponent } from "@kit/ui/calendar"
import { Checkbox } from "@kit/ui/checkbox"
import { Input } from "@kit/ui/input"
import { Label } from "@kit/ui/label"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@kit/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@kit/ui/select"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@kit/ui/sheet"
import { Textarea } from "@kit/ui/textarea"
import { format } from "date-fns"

interface TransactionPanelProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transaction?: any // Replace with your transaction type
    isReadOnly?: boolean
}

export function TransactionPanel({
                                     open,
                                     onOpenChange,
                                     transaction,
                                     isReadOnly = false,
                                 }: TransactionPanelProps) {
    const [date, setDate] = React.useState<Date>()
    const [isRecurring, setIsRecurring] = React.useState(false)
    const [attachments, setAttachments] = React.useState<File[]>([])
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setAttachments([...attachments, ...Array.from(event.target.files)])
        }
    }

    const removeAttachment = (index: number) => {
        setAttachments(attachments.filter((_, i) => i !== index))
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader>
                    <div className="flex items-center justify-between">
                        <SheetTitle>{isReadOnly ? "View Transaction" : "Edit Transaction"}</SheetTitle>
                    </div>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="date">Date*</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={`w-full justify-start text-left font-normal ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    disabled={isReadOnly}
                                >
                                    <Calendar className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PP") : "Select date"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <CalendarComponent
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    initialFocus
                                    disabled={isReadOnly}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Category*</Label>
                        <Select disabled={isReadOnly}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="category1">Category 1</SelectItem>
                                <SelectItem value="category2">Category 2</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="payee">Payee*</Label>
                        <Input id="payee" placeholder="Enter payee name" disabled={isReadOnly} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" placeholder="Add description" disabled={isReadOnly} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input
                            id="amount"
                            type="number"
                            placeholder="0.00"
                            className="text-right"
                            disabled={isReadOnly}
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="recurring"
                            checked={isRecurring}
                            onCheckedChange={(checked: boolean) => setIsRecurring(checked)}
                        />
                        <Label htmlFor="recurring">Recurring Transaction</Label>
                    </div>

                    {isRecurring && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="frequency">Frequency</Label>
                                <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select frequency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="yearly">Yearly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="endAfter">End After</Label>
                                <Select disabled={isReadOnly}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select end date" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="never">Never</SelectItem>
                                        <SelectItem value="occurrences">After occurrences</SelectItem>
                                        <SelectItem value="date">On date</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="account">Account*</Label>
                        <Select disabled={isReadOnly}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="account1">Account 1</SelectItem>
                                <SelectItem value="account2">Account 2</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Attachment</Label>
                        <div className="border-2 border-dashed rounded-lg p-6 text-center">
                            {attachments.length > 0 ? (
                                <div className="space-y-2">
                                    {attachments.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                                            <span className="text-sm truncate">{file.name}</span>
                                            {!isReadOnly && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeAttachment(index)}
                                                    className="text-destructive"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                    <div className="text-sm text-muted-foreground">
                                        Drag file(s) here to upload or
                                    </div>
                                </>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="hidden"
                                multiple
                                disabled={isReadOnly}
                            />
                            <Button
                                variant="outline"
                                className="mt-2"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isReadOnly}
                            >
                                Select files
                            </Button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            {isReadOnly ? "Close" : "Cancel"}
                        </Button>
                        <Button>Save</Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}