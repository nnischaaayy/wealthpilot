"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/layout/error-state";

export default function BudgetsError({
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
      title="Couldn't load your budget"
      description="Something went wrong pulling this together. Please try again."
      onRetry={reset}
    />
  );
}
