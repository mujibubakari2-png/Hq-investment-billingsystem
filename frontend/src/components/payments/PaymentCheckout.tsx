import React, { useState, useCallback } from "react";
import ProviderSelector from "./ProviderSelector";
import PaymentStatus from "./PaymentStatus";
import "./PaymentCheckout.css";

export interface PaymentCheckoutProps {
  /** Pre-fill amount (e.g. from an invoice) */
  amount?: number;
  /** Pre-fill phone */
  phone?: string;
  /** Label shown above the checkout (e.g. "Pay for Hotspot Package") */
  title?: string;
  /** Our internal reference — if provided, we use it; otherwise the API generates one */
  reference?: string;
  /** Called when payment is confirmed */
  onSuccess?: (reference: string, username?: string, password?: string) => void;
  /** Called when user cancels */
  onCancel?: () => void;
}

type CheckoutStep = "form" | "waiting" | "success" | "failed";

interface InitiateResponse {
  success: boolean;
  reference: string;
  providerRef?: string;
  provider: string;
  message: string;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export default function PaymentCheckout({
  amount: initialAmount,
  phone: initialPhone = "",
  title = "Make a Payment",
  reference: externalRef,
  onSuccess,
  onCancel,
}: PaymentCheckoutProps) {
  const [step, setStep] = useState<CheckoutStep>("form");
  const [provider, setProvider] = useState("ZENOPAY");
  const [phone, setPhone] = useState(initialPhone);
  const [amount, setAmount] = useState<number | "">(initialAmount ?? "");
  const [description, setDescription] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [providerRef, setProviderRef] = useState("");

  // ── Validation ────────────────────────────────────────────────────────────

  const validatePhone = useCallback((val: string) => {
    const digits = val.replace(/\D/g, "");
    if (digits.length < 9) return "Enter a valid Tanzanian phone number";
    return "";
  }, []);

  const validateAmount = useCallback((val: number | "") => {
    if (val === "" || isNaN(Number(val))) return "Amount is required";
    if (Number(val) < 100) return "Minimum amount is TZS 100";
    if (Number(val) > 10_000_000) return "Maximum amount is TZS 10,000,000";
    return "";
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    const pErr = validatePhone(phone);
    const aErr = validateAmount(amount);
    setPhoneError(pErr);
    setAmountError(aErr);
    if (pErr || aErr) return;

    setLoading(true);
    setApiError("");

    try {
      const token = localStorage.getItem("token") ?? "";
      const res = await fetch(`${API_BASE}/api/payments/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          phone,
          amount: Number(amount),
          description: description || undefined,
          reference: externalRef || undefined,
        }),
      });

      const data: InitiateResponse = await res.json();

      if (!res.ok || !data.success) {
        setApiError(data.message ?? "Failed to initiate payment");
        setLoading(false);
        return;
      }

      setTransactionRef(data.reference);
      setProviderRef(data.providerRef ?? "");
      setStep("waiting");
    } catch (err) {
      setApiError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === "waiting" || step === "success" || step === "failed") {
    return (
      <PaymentStatus
        reference={transactionRef}
        providerRef={providerRef}
        provider={provider}
        amount={Number(amount)}
        phone={phone}
        onSuccess={(ref, username, password) => {
          setStep("success");
          onSuccess?.(ref, username, password);
        }}
        onFailed={() => setStep("failed")}
        onRetry={() => setStep("form")}
      />
    );
  }

  return (
    <div className="payment-checkout">
      {/* Header */}
      <div className="checkout-header">
        <div className="checkout-icon">💳</div>
        <h2 className="checkout-title">{title}</h2>
        <p className="checkout-subtitle">
          Secure mobile money payment via East African networks
        </p>
      </div>

      <form onSubmit={handlePay} className="checkout-form">

        {/* Provider selector */}
        <div className="checkout-section">
          <label className="checkout-label">Payment Method</label>
          <ProviderSelector value={provider} onChange={setProvider} />
        </div>

        {/* Phone */}
        <div className="checkout-section">
          <label className="checkout-label" htmlFor="pay-phone">
            Phone Number
          </label>
          <div className="checkout-input-wrap">
            <span className="checkout-input-prefix">🇹🇿 +255</span>
            <input
              id="pay-phone"
              type="tel"
              className={`checkout-input${phoneError ? " input-error" : ""}`}
              placeholder="712 345 678"
              value={phone.replace(/^(\+?255|0)/, "")}
              onChange={(e) => {
                const raw = "0" + e.target.value.replace(/\D/g, "");
                setPhone(raw);
                setPhoneError(validatePhone(raw));
              }}
              autoComplete="tel"
              maxLength={12}
            />
          </div>
          {phoneError && <span className="checkout-error">{phoneError}</span>}
        </div>

        {/* Amount */}
        {!initialAmount && (
          <div className="checkout-section">
            <label className="checkout-label" htmlFor="pay-amount">
              Amount (TZS)
            </label>
            <div className="checkout-input-wrap">
              <span className="checkout-input-prefix">TZS</span>
              <input
                id="pay-amount"
                type="number"
                className={`checkout-input${amountError ? " input-error" : ""}`}
                placeholder="e.g. 5000"
                min={100}
                max={10000000}
                value={amount}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : Number(e.target.value);
                  setAmount(val);
                  setAmountError(validateAmount(val));
                }}
              />
            </div>
            {amountError && <span className="checkout-error">{amountError}</span>}
          </div>
        )}

        {/* Fixed amount display */}
        {initialAmount && (
          <div className="checkout-section">
            <label className="checkout-label">Amount</label>
            <div className="checkout-amount-display">
              <span className="amount-currency">TZS</span>
              <span className="amount-value">
                {initialAmount.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Description (optional) */}
        <div className="checkout-section">
          <label className="checkout-label" htmlFor="pay-desc">
            Description <span className="optional-tag">(optional)</span>
          </label>
          <input
            id="pay-desc"
            type="text"
            className="checkout-input"
            placeholder="What is this payment for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={100}
          />
        </div>

        {/* Error */}
        {apiError && (
          <div className="checkout-alert checkout-alert-error">
            <span>⚠️</span> {apiError}
          </div>
        )}

        {/* Actions */}
        <div className="checkout-actions">
          {onCancel && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            id="btn-pay-now"
            className="btn btn-primary checkout-pay-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-sm" />
                Sending prompt…
              </>
            ) : (
              <>
                <span>📲</span>
                Pay Now — TZS{" "}
                {(initialAmount ?? Number(amount) || 0).toLocaleString()}
              </>
            )}
          </button>
        </div>

        <p className="checkout-secure-note">
          🔒 Your payment is secured. You will receive a prompt on your phone.
        </p>
      </form>
    </div>
  );
}
