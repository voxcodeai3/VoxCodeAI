import { Menu } from 'lucide-react';

function HistoryButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border border-[#305080]/40 bg-[#050814]/60 p-2.5 text-[#60a0e0]/70 backdrop-blur-md transition-all duration-300 hover:border-[#5080c0]/60 hover:text-[#80c0ff] hover:shadow-[0_0_20px_-4px_rgba(50,100,200,0.35)] active:scale-95 ${className}`}
      aria-label="Open conversation history"
    >
      <Menu className="h-3.5 w-3.5" />
    </button>
  );
}

export default HistoryButton;
