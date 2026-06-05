import {useCallback, useState} from "react";
import {useToast} from "../components/Toast";

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface RunOptions<T> {
  success?: string;
  onSuccess?: (result: T) => void;
}

/**
 * Wraps an async mutation with a busy flag, error toast, and optional success
 * toast. Prevents double-submits while a call is in flight.
 */
export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const run = useCallback(
    async <T>(fn: () => Promise<T>, options?: RunOptions<T>): Promise<T | undefined> => {
      setBusy(true);
      try {
        const result = await fn();
        if (options?.success) toast.success(options.success);
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        toast.error(errorMessage(err));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  return {busy, run};
}
