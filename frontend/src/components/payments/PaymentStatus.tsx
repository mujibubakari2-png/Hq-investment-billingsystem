import { useEffect, useRef, useState, useCallback } from "react";
import "./PaymentCheckout.css";

interface PaymentStatusProps {
  reference: string;
  providerRef?: string;
  provider: string;
  amount: number;
  phone: string;
  onSuccess: (ref: string, username?: string, password?: string) => void;
  onFailed: () => void;
  onRetry: () => void;
}

interface StatusResponse {
  status: "PENDING" | "COMPLETED" | "FAILED" | "EXPIRED";
  reference: string;
  amount?: number;
  packageName?: string;
  message?: string;
  username?: string;
  password?: string;
  expiresAt?: string;
  autoConnect?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 45; // ~3 minutes

export default function PaymentStatus({
  reference,
  providerRef,
  provider,
  amount,
  phone,
  onSuccess,
  onFailed,
  onRetry,
}: PaymentStatusProps) {
  const [status, setStatus] = useState<StatusResponse["status"]>("PENDING");
  const [message, setMessage] = useState("Waiting for payment confirmation…");
  const [pollCount, setPollCount] = useState(0);
  const [dots, setDots] = useState(".");
  const [credentials, setCredentials] = useState<{ username?: string; password?: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Animated dots ─────────────────────────────────────────────────────────
  useEffect(() => {
    dotRef.current = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 500);
    return () => { if (dotRef.current) clearInterval(dotRef.current); };
  }, []);

  // ── Poll for status ───────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    try {

      const params = new URLSearchParams();
      if (provider) params.set("provider", provider);
      if (providerRef) params.set("providerRef", providerRef);

      const res = await fetch(
        `${API_BASE}/api/payments/status/${reference}?${params}`,
        { credentials: "include" }
      );

      if (!res.ok) return;
      const data: StatusResponse = await res.json();
      setStatus(data.status);
      setMessage(data.message ?? "");

      if (data.status === "COMPLETED") {
        if (pollRef.current) clearInterval(pollRef.current);
        if (dotRef.current) clearInterval(dotRef.current);
        if (data.username) setCredentials({ username: data.username, password: data.password });
        onSuccess(reference, data.username, data.password);
        return;
      }

      if (data.status === "FAILED" || data.status === "EXPIRED") {
        if (pollRef.current) clearInterval(pollRef.current);
        if (dotRef.current) clearInterval(dotRef.current);
        onFailed();
        return;
      }
    } catch {
      // Network hiccup — keep polling
    }

    setPollCount((c) => {
      const next = c + 1;
      if (next >= MAX_POLLS) {
        if (pollRef.current) clearInterval(pollRef.current);
        if (dotRef.current) clearInterval(dotRef.current);
        setMessage("Payment timed out. Please try again.");
        setStatus("FAILED");
        onFailed();
      }
      return next;
    });
  }, [reference, provider, providerRef, onSuccess, onFailed]);

  useEffect(() => {
    poll(); // immediate first poll
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [poll]);

  const timeoutSeconds = Math.round(((MAX_POLLS - pollCount) * POLL_INTERVAL_MS) / 1000);

  // ── Success screen ────────────────────────────────────────────────────────
  if (status === "COMPLETED") {
    return (
      <div className="payment-checkout">
        <div className="status-screen success-screen">
          <div className="status-icon success-icon">✅</div>
          <h2 className="status-title">Payment Confirmed!</h2>
          <p className="status-msg">Your payment of TZS {amount.toLocaleString()} was received.</p>

          {credentials?.username && (
            <div className="credentials-box">
              <p className="cred-label">Your Connection Credentials</p>
              <div className="cred-row">
                <span className="cred-key">Username</span>
                <span className="cred-val">{credentials.username}</span>
              </div>
              <div className="cred-row">
                <span className="cred-key">Password</span>
                <span className="cred-val">{credentials.password ?? phone}</span>
              </div>
            </div>
          )}

          <p className="status-ref">Ref: <code>{reference}</code></p>
        </div>
      </div>
    );
  }

  // ── Failed screen ─────────────────────────────────────────────────────────
  if (status === "FAILED" || status === "EXPIRED") {
    return (
      <div className="payment-checkout">
        <div className="status-screen failed-screen">
          <div className="status-icon failed-icon">❌</div>
          <h2 className="status-title">Payment Failed</h2>
          <p className="status-msg">{message || "Your payment could not be confirmed."}</p>
          <p className="status-ref">Ref: <code>{reference}</code></p>
          <div className="status-actions">
            <button id="btn-retry-payment" className="btn btn-primary" onClick={onRetry}>
              🔄 Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting screen ────────────────────────────────────────────────────────
  return (
    <div className="payment-checkout">
      <div className="status-screen waiting-screen">
        {/* Pulsing phone animation */}
        <div className="pulse-ring">
          <div className="pulse-icon">📲</div>
        </div>

        <h2 className="status-title">Waiting for Payment{dots}</h2>

        <div className="status-details">
          <div className="detail-row">
            <span className="detail-key">Phone</span>
            <span className="detail-val">{phone}</span>
          </div>
          <div className="detail-row">
            <span className="detail-key">Amount</span>
            <span className="detail-val">TZS {amount.toLocaleString()}</span>
          </div>
          <div className="detail-row">
            <span className="detail-key">Provider</span>
            <span className="detail-val">{provider}</span>
          </div>
        </div>

        <p className="status-instruction">
          📱 Check your phone for a payment prompt and enter your PIN to confirm.
        </p>

        {/* Progress bar */}
        <div className="poll-progress">
          <div
            className="poll-bar"
            style={{ width: `${(pollCount / MAX_POLLS) * 100}%` }}
          />
        </div>
        <p className="poll-timer">
          Checking status… {timeoutSeconds > 0 ? `(${timeoutSeconds}s remaining)` : ""}
        </p>

        <p className="status-ref">Ref: <code>{reference}</code></p>

        <button
          id="btn-cancel-payment"
          className="btn btn-secondary status-cancel-btn"
          onClick={onRetry}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
