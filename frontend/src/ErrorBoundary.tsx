import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#141414] text-red-500 p-8 font-mono">
          <h1 className="text-4xl mb-4 font-bold">CRITICAL SYSTEM FAILURE</h1>
          <p className="text-xl mb-8">React crashed during render.</p>
          <div className="bg-black/50 p-6 rounded-lg w-full max-w-4xl overflow-auto text-left border border-red-500/30">
            <h2 className="text-xl font-bold mb-2">Error: {this.state.error?.toString()}</h2>
            <pre className="text-xs text-red-400 whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
