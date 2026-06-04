import {AlertCircle, LockKeyhole} from "lucide-react";
import {FormEvent, useState} from "react";

interface LoginProps {
  signIn: (email: string, password: string) => Promise<void>;
  authError: string;
  configMissing: string[];
}

export function Login({signIn, authError, configMissing}: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={submit}>
        <div className="login-title">
          <LockKeyhole size={26} />
          <div>
            <h1>STL Risk Monitor</h1>
            <p>Authorized operations portal</p>
          </div>
        </div>
        {configMissing.length > 0 && (
          <div className="notice danger">
            <AlertCircle size={18} />
            Configure Firebase web environment variables in Vercel.
          </div>
        )}
        {(error || authError) && (
          <div className="notice danger">
            <AlertCircle size={18} />
            {error || authError}
          </div>
        )}
        <label>
          Email
          <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button className="primary" disabled={busy || configMissing.length > 0}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
