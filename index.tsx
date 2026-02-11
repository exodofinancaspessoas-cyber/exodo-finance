
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 text-red-900 h-screen flex flex-col items-center justify-center font-sans">
          <h1 className="text-2xl font-bold mb-4">Algo deu errado 😔</h1>
          <div className="bg-white p-4 rounded border border-red-200 text-sm overflow-auto max-w-full w-full max-w-2xl shadow-sm">
            <h2 className="font-bold mb-2">Detalhes do erro:</h2>
            <pre className="whitespace-pre-wrap font-mono text-xs">
              {this.state.error?.toString()}
            </pre>
            <p className="mt-4 text-xs text-slate-500">
              Verifique o console do desenvolvedor (F12) para mais detalhes.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-md transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);