import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 600, margin: '40px auto' }}>
          <h1 style={{ color: '#172B4D', marginBottom: 16 }}>エラーが発生しました</h1>
          <pre style={{ background: '#f4f5f7', padding: 16, borderRadius: 6, overflow: 'auto', fontSize: 12 }}>
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}
          >
            再試行
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
