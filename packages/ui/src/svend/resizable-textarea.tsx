'use client';

import React, { useRef } from 'react';
import { cn } from '../lib/utils';
import { Textarea, TextareaProps } from '../shadcn/textarea';

interface ResizableTextareaProps extends TextareaProps {
  maxHeight?: number;
  minHeight?: number;
}

const ResizableTextarea = React.forwardRef<HTMLTextAreaElement, ResizableTextareaProps>(
  ({ className, maxHeight = 200, minHeight = 80, ...props }, forwardedRef) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const isDraggingRef = useRef(false);
    const startYRef = useRef(0);
    const startHeightRef = useRef(0);

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      startYRef.current = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      startHeightRef.current = textareaRef.current?.offsetHeight ?? 0;

      const handleMove = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        if (!isDraggingRef.current || !textareaRef.current) return;

        const currentY = 'touches' in e 
          ? (e as TouchEvent).touches[0]?.clientY ?? startYRef.current
          : (e as MouseEvent).clientY;
        const diff = currentY - startYRef.current;
        const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeightRef.current + diff));
        textareaRef.current.style.height = `${newHeight}px`;
      };

      const handleEnd = () => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', handleMove as any);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleMove as any);
        document.removeEventListener('touchend', handleEnd);
      };

      document.addEventListener('mousemove', handleMove as any);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove as any);
      document.addEventListener('touchend', handleEnd);
    };

    return (
      <div className="relative">
        <Textarea
          {...props}
          ref={(e) => {
            if (typeof forwardedRef === 'function') {
              forwardedRef(e);
            } else if (forwardedRef) {
              forwardedRef.current = e;
            }
            textareaRef.current = e;
          }}
          className={cn("resize-none pb-6", className)}
        />
        <div 
          className="absolute bottom-0 left-0 right-0 h-6 cursor-ns-resize flex items-center justify-center"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="w-8 h-1 rounded-full bg-muted-foreground/20" />
        </div>
      </div>
    );
  }
);

ResizableTextarea.displayName = 'ResizableTextarea';

export { ResizableTextarea }; 