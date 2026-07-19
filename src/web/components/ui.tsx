import type { ButtonHTMLAttributes, ReactNode } from "react";

import { XIcon } from "./icons.js";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

const buttonVariants = {
  primary: "border-revive bg-revive text-white hover:border-revive-dark hover:bg-revive-dark",
  secondary: "border-line bg-panel text-ink hover:border-[#cbd2cc] hover:bg-[#fafbf9]",
  ghost: "border-transparent bg-transparent text-muted hover:bg-[#eef1ed] hover:text-ink",
  danger: "border-[#e6caca] bg-white text-[#9e3f3f] hover:bg-[#fff7f7]",
} as const;

export function Button({
  className,
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-revive border px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        className,
      )}
      type="button"
      {...props}
    />
  );
}

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-revive border border-transparent text-muted transition-colors hover:bg-[#eef1ed] hover:text-ink",
        className,
      )}
      type="button"
      {...props}
    />
  );
}

export function StatusDot({ tone = "healthy" }: { tone?: "healthy" | "warning" | "offline" }) {
  return <span className={cn(
    "inline-block h-1.5 w-1.5 rounded-full",
    tone === "healthy" && "bg-revive",
    tone === "warning" && "bg-amber",
    tone === "offline" && "bg-[#a9b0aa]",
  )} />;
}

export function EmptyState({ icon, title, detail, action }: {
  icon?: ReactNode;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
      {icon === undefined ? null : <div className="mb-4 text-muted">{icon}</div>}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">{detail}</p>
      {action === undefined ? null : <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div aria-label={label} className="inline-flex rounded-revive border border-line bg-panel p-0.5" role="group">
      {options.map((option) => (
        <button
          aria-pressed={value === option.value}
          className={cn(
            "h-7 rounded-[6px] px-3 text-sm transition-colors",
            value === option.value ? "bg-ink text-white" : "text-muted hover:text-ink",
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Drawer({ title, children, onClose }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }} role="presentation">
      <aside aria-label={title} aria-modal="true" className="h-full w-full max-w-md overflow-y-auto border-l border-line bg-panel shadow-panel" role="dialog">
        <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-panel px-5">
          <h2 className="text-base font-semibold">{title}</h2>
          <IconButton aria-label={`Close ${title}`} onClick={onClose}><XIcon /></IconButton>
        </div>
        <div className="p-5">{children}</div>
      </aside>
    </div>
  );
}

export function Modal({ title, children, onClose }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }} role="presentation">
      <section aria-label={title} aria-modal="true" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-panel shadow-[0_16px_50px_-12px_rgba(20,30,25,0.45)]" role="dialog">
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <h2 className="text-base font-semibold">{title}</h2>
          <IconButton aria-label={`Close ${title}`} onClick={onClose}><XIcon /></IconButton>
        </div>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
