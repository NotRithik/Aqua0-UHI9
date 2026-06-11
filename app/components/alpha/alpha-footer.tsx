import Image from "next/image"

export function AlphaFooter() {
  return (
    <footer className="relative z-10 mt-auto flex flex-col items-start justify-between gap-4 border-t border-white/10 bg-black/40 px-6 py-6 text-[13px] sm:flex-row sm:items-center sm:px-10">
      <div className="flex items-center gap-2.5">
        <Image
          src="/aqua0-logo.png"
          alt="Aqua0"
          width={18}
          height={18}
          className="h-[18px] w-[18px]"
          unoptimized
        />
        <span className="font-semibold text-white">Aqua0</span>
        <span className="text-white/40">
          · Alpha on Base Sepolia &amp; Unichain Sepolia
        </span>
      </div>

      <div className="flex items-center gap-6 text-white/60">
        <a
          href="https://docs.aqua0.xyz/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-white"
        >
          Docs
        </a>
        <a
          href="https://docs.aqua0.xyz/docs/audits"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-white"
        >
          Audits
        </a>
        <a
          href="https://x.com/AquaZero0"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-white"
        >
          X
        </a>
        <a
          href="https://t.me/+eDStwZjBW6gyMjdh"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-white"
        >
          Telegram
        </a>
      </div>
    </footer>
  )
}
