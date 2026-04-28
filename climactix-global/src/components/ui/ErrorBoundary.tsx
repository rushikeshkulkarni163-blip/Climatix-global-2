"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="card flex items-center gap-4 text-orange-700 border border-orange-200 bg-orange-50">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-semibold">Component error</p>
              <p className="text-sm text-orange-600">{this.state.error?.message}</p>
            </div>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="ml-auto text-sm btn-secondary py-1.5 px-3"
            >
              Retry
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
