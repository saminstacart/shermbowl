"use client";
import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="text-sm font-bold text-[#e8e8ed] mb-2">Something went wrong</div>
          <p className="text-xs text-[#6b6b7b] mb-4">
            {this.props.fallbackMessage ||
              "An unexpected error occurred. Reload to try again."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-[#0a0a0f] font-bold rounded-xl text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
