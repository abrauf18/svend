import {
  Tooltip as TooltipComp,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';
import { InfoIcon } from 'lucide-react';

type Props = {
  className?: string;
  message: string;
};

export default function Tooltip({ className, message }: Props) {
  return (
    <TooltipProvider>
      <TooltipComp delayDuration={0}>
        <TooltipTrigger asChild>
          <div className={cn(className)}>
            <InfoIcon className={`size-5 text-muted-foreground`} />
          </div>
        </TooltipTrigger>
        <TooltipContent className={`border bg-background text-primary`}>
          <p>{message}</p>
        </TooltipContent>
      </TooltipComp>
    </TooltipProvider>
  );
}
