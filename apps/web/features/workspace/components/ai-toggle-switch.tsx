"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { setAiEnabledAction } from "@/features/workspace/actions";

export function AiToggleSwitch({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  return (
    <Switch
      checked={enabled}
      disabled={isPending}
      aria-label="AI advisor data usage"
      onCheckedChange={(next) => {
        setEnabled(next);
        startTransition(async () => {
          const result = await setAiEnabledAction(next);
          if (result.error) {
            setEnabled(!next); // revert on failure
            return;
          }
          router.refresh();
        });
      }}
    />
  );
}
