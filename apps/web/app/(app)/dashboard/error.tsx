"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/layout/error-state";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Couldn't load your dashboard"
      description="Something went wrong pulling your numbers together. Please try again."
      onRetry={reset}
    />
  );
}
