import VoxLogo from './VoxLogo'
import AIWeave from './AIWeave'
import FuturisticBackground from './FuturisticBackground'

function AuthLoading() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <FuturisticBackground />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-5 py-10">
        <VoxLogo />
        <div className="mt-8 w-full max-w-md animate-fade-up">
          <div className="vox-box-glow rounded-2xl border border-cyan-400/15 bg-[#040a14]/80 p-8 text-center backdrop-blur-2xl">
            <div className="vox-line absolute inset-x-10 top-0 h-px" />
            <div className="absolute inset-x-10 bottom-0 h-px opacity-40 vox-line" />
            <div className="mx-auto w-full max-w-[200px] opacity-70">
              <AIWeave />
            </div>
            <p className="mt-6 text-sm tracking-wide text-slate-300">
              Initializing secure session...
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthLoading