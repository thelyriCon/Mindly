import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Mindly uncaught render error:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('mindly_local_db');
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0c0d10] text-zinc-200 flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 rounded-2xl bg-[#14151a] border border-[#272932] shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-white">Something interrupted your session</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Mindly encountered a display error. You can reload the application safely.
            </p>
            {this.state.error?.message && (
              <div className="p-3 rounded-lg bg-black/40 border border-zinc-800 text-[11px] text-zinc-400 font-mono text-left overflow-x-auto">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Workspace</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
