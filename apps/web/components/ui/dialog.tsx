"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  type HTMLAttributes,
  type JSX,
  type MouseEvent,
  type ReactElement,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
};

const DialogContext = createContext<DialogContextValue | null>(null);

const useDialogContext = (): DialogContextValue => {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error("Dialog components must be used within Dialog.");
  }

  return context;
};

export function Dialog({
  open,
  onOpenChange,
  children
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}): JSX.Element {
  const baseId = useId();

  return (
    <DialogContext.Provider value={{
      open,
      onOpenChange,
      titleId: `${baseId}-title`,
      descriptionId: `${baseId}-description`
    }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  asChild = false,
  children
}: {
  asChild?: boolean;
  children: ReactNode;
}): JSX.Element {
  const { onOpenChange } = useDialogContext();

  if (asChild && isValidElement(children)) {
    const child = Children.only(children) as ReactElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>;

    return cloneElement(child, {
      onClick: (event: MouseEvent<HTMLElement>) => {
        child.props.onClick?.(event);

        if (!event.defaultPrevented) {
          onOpenChange(true);
        }
      }
    });
  }

  return (
    <button type="button" onClick={() => onOpenChange(true)}>
      {children}
    </button>
  );
}

export function DialogContent({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element | null {
  const { open, onOpenChange, titleId, descriptionId } = useDialogContext();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="dialog-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onOpenChange(false);
      }
    }}>
      <div
        {...props}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`dialog-content${className ? ` ${className}` : ""}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DialogHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div {...props} className={`dialog-header${className ? ` ${className}` : ""}`} />;
}

export function DialogFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div {...props} className={`dialog-footer${className ? ` ${className}` : ""}`} />;
}

export function DialogTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  const { titleId } = useDialogContext();
  return <h2 {...props} id={titleId} className={`dialog-title${className ? ` ${className}` : ""}`} />;
}

export function DialogDescription({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  const { descriptionId } = useDialogContext();
  return <p {...props} id={descriptionId} className={`dialog-description${className ? ` ${className}` : ""}`} />;
}