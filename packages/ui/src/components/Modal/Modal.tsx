'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import type { ModalProps, ModalSectionProps } from './Modal.types';

const contentVariants = cva(
  'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-cream-50 rounded-xl shadow-xl border border-cream-200 p-6 w-full z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  {
    variants: {
      size: {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

function ModalRoot({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  requireExplicitClose,
  closeLabel = 'Close',
  children,
}: ModalProps) {
  const blockClose = requireExplicitClose
    ? {
        onPointerDownOutside: (e: Event) => e.preventDefault(),
        onEscapeKeyDown: (e: KeyboardEvent) => e.preventDefault(),
      }
    : {};

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-charcoal-900/60 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className={cn(contentVariants({ size }))} {...blockClose}>
          {title && (
            <Dialog.Title className="font-display text-xl text-charcoal-800 mb-2">
              {title}
            </Dialog.Title>
          )}
          {description && (
            <Dialog.Description className="text-sm text-charcoal-500 mb-4">
              {description}
            </Dialog.Description>
          )}
          {children}
          {!requireExplicitClose && (
            <Dialog.Close asChild>
              <button
                className="absolute top-4 right-4 text-charcoal-500 hover:text-charcoal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 rounded"
                aria-label={closeLabel}
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ModalBody({ children, className }: ModalSectionProps) {
  return <div className={cn('mb-6', className)}>{children}</div>;
}
ModalBody.displayName = 'Modal.Body';

function ModalFooter({ children, className }: ModalSectionProps) {
  return (
    <div className={cn('flex justify-end gap-2 pt-4 border-t border-cream-200', className)}>
      {children}
    </div>
  );
}
ModalFooter.displayName = 'Modal.Footer';

export const Modal = Object.assign(ModalRoot, {
  Body: ModalBody,
  Footer: ModalFooter,
});
