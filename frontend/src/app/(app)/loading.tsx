export default function AppLoading() {
  return (
    <div className="relative min-h-[4rem] w-full" aria-busy="true" aria-live="polite">
      <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-stone-200 dark:bg-stone-800">
        <div className="h-full w-1/3 animate-pulse bg-teal-700" />
      </div>
      <p className="sr-only">Loading</p>
    </div>
  );
}
