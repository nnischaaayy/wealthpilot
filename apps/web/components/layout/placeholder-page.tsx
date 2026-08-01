export function PlaceholderPage({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground max-w-prose text-sm">{description}</p>
      <p className="text-muted-foreground mt-4 text-xs">Ships in {phase}.</p>
    </div>
  );
}
