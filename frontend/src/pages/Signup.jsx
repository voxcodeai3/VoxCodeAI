import VoxLogo from '../components/VoxLogo'
import AIWeave from '../components/AIWeave'
import SignupForm from '../components/SignupForm'
import FuturisticBackground from '../components/FuturisticBackground'

function Signup() {
  return (
    <div className="relative min-h-screen overflow-hidden overflow-x-hidden">
      <FuturisticBackground />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-6 px-4 py-8 sm:px-5 sm:py-10 lg:flex-row lg:gap-16 lg:py-10">
        <section className="flex flex-col items-center text-center lg:flex-1 lg:items-start lg:text-left">
          <div className="animate-fade-up">
            <VoxLogo />
          </div>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-300/90 animate-fade-up lg:text-base">
            Your personal AI coding teacher. Learn programming through voice,
            practice, and intelligent guidance.
          </p>
          <p className="mt-3 max-w-md text-xs tracking-[0.3em] uppercase text-cyan-400/70 animate-fade-up">
            Enter the VoxCode network
          </p>

          <div className="mt-8 hidden w-full max-w-md lg:block animate-fade-up">
            <AIWeave />
          </div>
        </section>

        <section className="w-full max-w-md sm:max-w-[420px] animate-fade-up">
            <div className="vox-box-glow relative rounded-2xl border border-cyan-400/15 bg-[#040a14]/80 p-5 backdrop-blur-2xl sm:p-7 lg:p-9">
            <div className="vox-line absolute inset-x-10 top-0 h-px" />
            <div className="absolute inset-x-10 bottom-0 h-px opacity-40 vox-line" />

            <div className="mb-6 text-center">
              <h1 className="vox-text-glow text-xl font-bold tracking-wide text-white sm:text-2xl lg:text-3xl">
                Create Your Account
              </h1>
              <p className="mt-1.5 text-sm text-slate-400">
                Start your journey with VoxCode AI
              </p>
            </div>

            <SignupForm />
          </div>
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-center justify-center pb-5 lg:hidden">
        <div className="w-40 opacity-60 sm:w-48 md:w-56 lg:hidden">
          <AIWeave />
        </div>
      </div>
    </div>
  )
}

export default Signup