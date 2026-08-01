import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-brand text-2xl font-semibold tracking-tight">WealthPilot</span>
      </Link>
      {children}
      <p className="text-muted-foreground max-w-sm text-center text-xs text-balance">
        WealthPilot provides informational analysis only and is not a licensed financial or
        investment advisor.
      </p>
    </div>
  );
}
