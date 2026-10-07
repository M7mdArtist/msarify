import React, { StrictMode, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 text-center" dir="rtl">
          <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto text-2xl font-black">
              ⚠️
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black">حدث خطأ غير متوقع</h2>
              <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                تم حفظ بياناتك بأمان. يمكنك إعادة تحميل الصفحة للمتابعة.
              </p>
            </div>
            <div className="space-y-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-white text-zinc-950 font-black rounded-2xl text-sm shadow-lg active:scale-95 transition-all"
              >
                إعادة تحميل الصفحة
              </button>
              <button
                onClick={this.handleReset}
                className="w-full py-3 bg-zinc-800 text-zinc-400 hover:text-white font-bold rounded-2xl text-xs transition-all"
              >
                تسجيل الخروج والبدء من جديد
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
