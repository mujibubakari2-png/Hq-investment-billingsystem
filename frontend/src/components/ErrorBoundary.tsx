import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '60vh',
                    padding: '40px 20px',
                    textAlign: 'center',
                }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 28,
                        marginBottom: 20,
                    }}>
                        ⚠️
                    </div>
                    <h2 style={{
                        margin: '0 0 8px',
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        color: '#1e293b',
                    }}>
                        Something went wrong
                    </h2>
                    <p style={{
                        margin: '0 0 24px',
                        fontSize: '0.95rem',
                        color: '#64748b',
                        maxWidth: 420,
                    }}>
                        An unexpected error occurred. Please try refreshing the page.
                    </p>
                    <div style={{
                        display: 'flex',
                        gap: 12,
                    }}>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '10px 24px',
                                borderRadius: 8,
                                border: 'none',
                                background: '#2563eb',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                            }}
                        >
                            Refresh Page
                        </button>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            style={{
                                padding: '10px 24px',
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                                background: '#fff',
                                color: '#334155',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <details style={{
                            marginTop: 24,
                            padding: '12px 16px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: 8,
                            maxWidth: 600,
                            width: '100%',
                            textAlign: 'left',
                        }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#991b1b', fontSize: '0.85rem' }}>
                                Error Details (dev only)
                            </summary>
                            <pre style={{
                                marginTop: 8,
                                fontSize: '0.8rem',
                                color: '#7f1d1d',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                            }}>
                                {this.state.error.message}
                                {'\n\n'}
                                {this.state.error.stack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
