import { requireActiveWorkspace } from "@/lib/workspace-context";
import { buildPeriodReport } from "@/features/exports/server/report";
import { reportToCsv } from "@/features/exports/server/csv";
import { reportToPdf } from "@/features/exports/server/pdf";

export async function GET(request: Request) {
  const { workspaceId } = await requireActiveWorkspace();

  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? "this-month";
  const format = url.searchParams.get("format") ?? "csv";

  if (period !== "this-month") {
    return Response.json({ error: "Only period=this-month is supported" }, { status: 400 });
  }
  if (format !== "csv" && format !== "pdf") {
    return Response.json({ error: "format must be csv or pdf" }, { status: 400 });
  }

  const report = await buildPeriodReport(workspaceId);
  if (!report) {
    return Response.json({ error: "No transactions to report on yet" }, { status: 404 });
  }

  const filename = `wealthpilot-summary-${new Date().toISOString().slice(0, 10)}.${format}`;

  if (format === "csv") {
    return new Response(reportToCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const pdfBytes = await reportToPdf(report);
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
