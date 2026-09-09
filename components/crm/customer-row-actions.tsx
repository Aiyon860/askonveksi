"use client";

export function CustomerRowActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
      {children}
    </div>
  );
}
