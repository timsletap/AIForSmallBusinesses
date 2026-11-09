"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print min-h-12 px-5 rounded-xl bg-brand text-on-brand font-bold hover:bg-brand-hover"
    >
      Print my plan
    </button>
  );
}
