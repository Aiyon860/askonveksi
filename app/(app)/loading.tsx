export default function ProtectedLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="Memuat halaman">
      <span className="sr-only">Memuat halaman...</span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-[min(38rem,80vw)] animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border bg-background" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border bg-background" />
    </div>
  );
}
