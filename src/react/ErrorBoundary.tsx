/**
 * The last guard: a render-time throw shows a calm card instead of a white
 * screen. Data paths catch their own failures; this catches what they miss.
 *
 * The crash is pushed to the package debug log (scrubbed, and persisted when
 * the site turned that on), so it can still be read after a reload. The
 * default card shows the error and offers Copy error + log / Try again /
 * Reload chips. Mechanics only: `classNames` styles it, or `fallback` replaces
 * it entirely.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { debugLogText, debugPush } from "../debugLog.ts";
import { errorReport } from "../errorReport.ts";

export interface ErrorFallbackProps {
  error: Error;
  componentStack: string;
  /** The error, its stacks and the recent activity log, ready to copy. */
  report: () => string;
  /** Render the children again. */
  reset: () => void;
}

export interface ErrorBoundaryClassNames {
  root?: string;
  title?: string;
  message?: string;
  /** The <pre> with the error and component stack. */
  detail?: string;
  /** The row of chips. */
  actions?: string;
  chip?: string;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Replace the default card. */
  fallback?: ReactNode | ((p: ErrorFallbackProps) => ReactNode);
  title?: ReactNode;
  message?: ReactNode;
  /** Show the error text and component stack on the card. Default true. */
  showDetail?: boolean;
  onError?: (error: Error, componentStack: string) => void;
  classNames?: ErrorBoundaryClassNames;
}

interface State {
  error: Error | null;
  stack: string;
  copied: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null, stack: "", copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const stack = info.componentStack ?? "";
    this.setState({ stack });
    debugPush("error", `render crash: ${error.message}`);
    console.error("Unhandled render error:", error, stack);
    this.props.onError?.(error, stack);
  }

  private report = (): string => errorReport(this.state.error, this.state.stack, debugLogText());

  private reset = (): void => this.setState({ error: null, stack: "", copied: false });

  private copy = (): void => {
    navigator.clipboard?.writeText(this.report()).then(
      () => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 1500);
      },
      () => {},
    );
  };

  render(): ReactNode {
    const { error, stack, copied } = this.state;
    if (!error) return this.props.children;

    const { fallback, title = "Something went sideways", showDetail = true, classNames: c = {} } = this.props;
    if (typeof fallback === "function") {
      return fallback({ error, componentStack: stack, report: this.report, reset: this.reset });
    }
    if (fallback !== undefined) return fallback;

    const message =
      this.props.message ??
      "The page hit an unexpected error. It is saved to the debug log — copy it into a bug report. Reloading usually clears it.";
    return (
      <div role="alert" className={c.root}>
        <h1 className={c.title}>{title}</h1>
        <p className={c.message}>{message}</p>
        {showDetail && (
          <pre className={c.detail}>
            {error.message}
            {stack ? `\n${stack}` : ""}
          </pre>
        )}
        <div className={c.actions}>
          <button type="button" onClick={this.copy} className={c.chip}>
            {copied ? "Copied" : "Copy error + log"}
          </button>
          <button type="button" onClick={this.reset} className={c.chip}>
            Try again
          </button>
          <button type="button" onClick={() => window.location.reload()} className={c.chip}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
