import {AlertCircle} from "lucide-react";
import {Component, type ErrorInfo, type ReactNode} from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{children: ReactNode}, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="center-screen">
          <div className="login-panel">
            <div className="login-title">
              <AlertCircle size={26} />
              <div>
                <h1>Something went wrong</h1>
                <p>The page hit an unexpected error. Reloading usually fixes it.</p>
              </div>
            </div>
            <p className="muted">{this.state.error.message}</p>
            <button className="primary" onClick={() => window.location.reload()}>
              Reload app
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
