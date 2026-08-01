// Every chart needs a data-table alternative for screen readers (architecture.md
// §6.2); a native <details> disclosure keeps it keyboard-operable with no JS.
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="mt-2">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium">
        View as table
      </summary>
      <div className="mt-2 overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-muted">
              {columns.map((col) => (
                <th key={col} scope="col" className="px-2 py-1.5 text-left font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t">
                {row.map((cell, j) => (
                  <td key={j} className="tabular-nums px-2 py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
