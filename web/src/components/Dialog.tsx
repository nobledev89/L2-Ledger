import {AlertTriangle} from "lucide-react";
import {createContext, useCallback, useContext, useMemo, useState, type ReactNode} from "react";
import {Modal} from "./Modal";

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

interface PromptOptions extends ConfirmOptions {
  label: string;
  defaultValue?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal";
  validate?: (value: string) => string | null;
}

interface DialogApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

type DialogState =
  | {kind: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void}
  | {kind: "prompt"; options: PromptOptions; resolve: (value: string | null) => void}
  | null;

export function DialogProvider({children}: {children: ReactNode}) {
  const [state, setState] = useState<DialogState>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({kind: "confirm", options, resolve})),
    [],
  );

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(options.defaultValue ?? "");
        setError("");
        setState({kind: "prompt", options, resolve});
      }),
    [],
  );

  const api = useMemo<DialogApi>(() => ({confirm, prompt}), [confirm, prompt]);

  function cancel() {
    if (!state) return;
    if (state.kind === "prompt") state.resolve(null);
    else state.resolve(false);
    setState(null);
  }

  function submit() {
    if (!state) return;
    if (state.kind === "prompt") {
      const trimmed = value.trim();
      const validation = state.options.validate?.(trimmed);
      if (validation) {
        setError(validation);
        return;
      }
      state.resolve(trimmed);
    } else {
      state.resolve(true);
    }
    setState(null);
  }

  const tone = state?.options.tone ?? "default";

  return (
    <DialogContext.Provider value={api}>
      {children}
      {state && (
        <Modal
          title={state.options.title}
          size="sm"
          onClose={cancel}
          footer={
            <>
              <button className="secondary" type="button" onClick={cancel}>
                {state.options.cancelLabel ?? "Cancel"}
              </button>
              <button className={tone === "danger" ? "primary danger-action" : "primary"} type="button" onClick={submit}>
                {state.options.confirmLabel ?? (state.kind === "prompt" ? "Submit" : "Confirm")}
              </button>
            </>
          }
        >
          <form
            className="dialog-body"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            {tone === "danger" && (
              <div className="dialog-icon" aria-hidden>
                <AlertTriangle size={22} />
              </div>
            )}
            {state.options.message && <p className="dialog-message">{state.options.message}</p>}
            {state.kind === "prompt" && (
              <label>
                {state.options.label}
                <input
                  autoFocus
                  inputMode={state.options.inputMode}
                  placeholder={state.options.placeholder}
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value);
                    if (error) setError("");
                  }}
                />
              </label>
            )}
            {error && <div className="notice danger">{error}</div>}
            <button type="submit" hidden aria-hidden tabIndex={-1} />
          </form>
        </Modal>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}
