"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print min-h-12 px-5 rounded-xl bg-brand text-white font-bold hover:bg-brand-strong"
    >
      Print my plan
    </button>
  );
}
