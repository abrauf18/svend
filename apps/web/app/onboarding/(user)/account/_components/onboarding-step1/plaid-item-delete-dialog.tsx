'use client';

import React from 'react';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { Trash2 } from 'lucide-react';
import { cn } from '@kit/ui/utils';
import { buttonVariants } from '@kit/ui/button';

export function ItemDeleteDialog({ close }: { close: (role: string) => void }) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="ghost" size="icon">
					<Trash2 className="h-6 w-6" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete this connection and all accounts associated with it? This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={() => close('cancel')}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						className={cn(buttonVariants({ variant: 'destructive' }))}
						onClick={() => close('confirm')}
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
