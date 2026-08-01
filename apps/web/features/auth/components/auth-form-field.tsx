import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { UseFormRegisterReturn } from "react-hook-form";

interface AuthFormFieldProps {
  id: string;
  label: string;
  type?: string;
  register: UseFormRegisterReturn;
  error?: string;
  autoComplete?: string;
}

export function AuthFormField({
  id,
  label,
  type = "text",
  register,
  error,
  autoComplete,
}: AuthFormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...register}
      />
      {error && (
        <p id={errorId} role="alert" className="text-negative text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
