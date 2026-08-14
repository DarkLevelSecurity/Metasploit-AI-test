import React from 'react';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="panel" style={{ margin: '1.5rem' }}>
          <h1 style={{ marginTop: 0 }}>UI failed to load</h1>
          <pre className="terminal">{this.state.error.message}</pre>
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
