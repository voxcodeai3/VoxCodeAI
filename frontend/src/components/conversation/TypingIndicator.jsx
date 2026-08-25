function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 ml-auto max-w-[70%] mr-4">
      <div className="h-3 w-3 rounded-full bg-cyan-400" />
      <span className="text-xs text-cyan-300">VOXCODE AI</span>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 w-1 rounded-full bg-cyan-300"
            style={{ animation: 'dot-pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <span className="text-xs text-cyan-400/60">Thinking...</span>
    </div>
  );
}

export default TypingIndicator;
