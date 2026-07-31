import { Minus, Plus } from "lucide-react";

interface CartQuantityControlsProps {
  quantity: number;
  maxQuantity: number;
  onChange: (quantity: number) => void;
  size?: "sm" | "md";
}

export default function CartQuantityControls({
  quantity,
  maxQuantity,
  onChange,
  size = "sm",
}: CartQuantityControlsProps) {
  const buttonSize = size === "md" ? "w-8 h-8" : "w-7 h-7";
  const iconSize = size === "md" ? 14 : 12;
  const valueWidth = size === "md" ? "w-8" : "w-5";

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange(quantity - 1)}
        disabled={quantity <= 1}
        className={`${buttonSize} rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all`}
        aria-label="Decrease quantity"
      >
        <Minus size={iconSize} />
      </button>
      <span className={`text-sm font-bold ${valueWidth} text-center text-slate-900`}>{quantity}</span>
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        disabled={quantity >= maxQuantity}
        className={`${buttonSize} rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all`}
        aria-label="Increase quantity"
      >
        <Plus size={iconSize} />
      </button>
    </div>
  );
}
