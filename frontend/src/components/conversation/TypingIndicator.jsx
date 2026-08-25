function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 ml-auto max-w-[70%] mr-4">
      <div className="h-3 w-3 rounded-full bg-white/[0.04]" />
      <div className="h-3 w-3 rounded-full bg-white/[0.04]" />
      <div className="h-3 w-3 rounded-full bg-white/[0.04]" />
      <span className="text-xs text-cyan-400/60">typing...</span>
    </div>
  );
}

export default TypingIndicator;