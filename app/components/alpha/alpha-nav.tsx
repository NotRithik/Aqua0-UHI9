"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useWallet } from "@/contexts/wallet-context"

const navLinks = [
  { href: "/", label: "Pools" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/swap", label: "Swap" },
]

const chainIcons: Record<number, string> = {
  8453: "/crypto/Base.png",
  84532: "/crypto/Base.png",
  1301: "/crypto/Unichain.png",
}

const chainNames: Record<number, string> = {
  8453: "Base",
  84532: "Base Sepolia",
  1301: "Unichain Sepolia",
}

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`
}

export function AlphaNav() {
  const pathname = usePathname()
  const { isConnected, address, connect, disconnect, chainId } = useWallet()

  return (
    <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/40 px-6 py-4 backdrop-blur-sm sm:px-10">
      {/* Left — logo + brand + ALPHA tag */}
      <Link href="/" className="flex items-center gap-2.5">
        <Image
          src="/aqua0-logo.png"
          alt="Aqua0"
          width={24}
          height={24}
          className="h-6 w-6"
          unoptimized
        />
        <span className="text-[16px] font-semibold tracking-[0.01em] text-white">
          Aqua0
        </span>
        <span className="ml-1 rounded border border-[#7FE5E5]/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-[#7FE5E5]">
          Alpha
        </span>
      </Link>

      {/* Center — nav */}
      <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1 md:flex">
        {navLinks.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname === link.href || pathname.startsWith(`${link.href}/`)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-5 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>

      {/* Right — connection */}
      <div className="flex items-center gap-2">
        {!isConnected ? (
          <button
            onClick={connect}
            className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black transition-transform hover:-translate-y-px"
          >
            Connect Wallet
          </button>
        ) : (
          <>
            {chainId && (
              <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12px] font-medium text-white/80 sm:flex">
                {chainIcons[chainId] && (
                  <Image
                    src={chainIcons[chainId]}
                    alt={chainNames[chainId] ?? "Chain"}
                    width={16}
                    height={16}
                    className="h-4 w-4 rounded-full"
                    unoptimized
                  />
                )}
                <span>{chainNames[chainId] ?? `Chain ${chainId}`}</span>
              </div>
            )}
            <button
              onClick={disconnect}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#7FE5E5] shadow-[0_0_6px_#7FE5E5]" />
              {address ? truncate(address) : "..."}
            </button>
          </>
        )}
      </div>
    </header>
  )
}
