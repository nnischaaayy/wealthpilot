const PROMPTS = [
  "How much have I spent on dining this month?",
  "Am I on track with my 50/30/20 budget?",
  "How concentrated is my portfolio?",
  "Summarize my spending this month",
  "What is diversification?",
];

export function AdvisorSuggestedPrompts({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onSelect(prompt)}
          className="rounded-full border border-input px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
