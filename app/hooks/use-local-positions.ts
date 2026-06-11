"use client"

import { useState, useEffect } from 'react'

export interface LocalPosition {
  positionId: string
  poolId: string
  tickLower: number
  tickUpper: number
  liquidityShares: string
  amount0: string
  amount1: string
  hedgeEnabled: boolean
  hedgeAmount: string
  strikePrice: number
  premiumPaid: number
  active: boolean
  timestamp: number
}

const STORAGE_KEY = 'aqua0_simulated_positions'
const PRICE_KEY = 'aqua0_simulated_eth_price'
const BALANCES_KEY = 'aqua0_simulated_slp_balances'

export interface SimulatedSLPBalances {
  [tokenAddress: string]: string; // e.g. "0x...": "1000.0"
}

export function getSimulatedSLPBalances(): SimulatedSLPBalances {
  if (typeof window === 'undefined') return {}
  const data = localStorage.getItem(BALANCES_KEY)
  return data ? JSON.parse(data) : {}
}

export function saveSimulatedSLPBalances(balances: SimulatedSLPBalances) {
  if (typeof window === 'undefined') return
  localStorage.setItem(BALANCES_KEY, JSON.stringify(balances))
  window.dispatchEvent(new Event('storage_balances_changed'))
}

export function getLocalPositions(): LocalPosition[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEY)
  return data ? JSON.parse(data) : []
}

export function saveLocalPositions(positions: LocalPosition[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
  window.dispatchEvent(new Event('storage_positions_changed'))
}

export function getSimulatedPrice(): number {
  if (typeof window === 'undefined') return 2000
  const val = localStorage.getItem(PRICE_KEY)
  return val ? parseFloat(val) : 2000
}

export function saveSimulatedPrice(price: number) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PRICE_KEY, price.toString())
  window.dispatchEvent(new Event('storage_price_changed'))
}

export function useLocalPositions() {
  const [positions, setPositions] = useState<LocalPosition[]>([])
  const [marketPrice, setMarketPrice] = useState<number>(2000)
  const [simulatedBalances, setSimulatedBalances] = useState<SimulatedSLPBalances>({})

  useEffect(() => {
    setPositions(getLocalPositions())
    setMarketPrice(getSimulatedPrice())
    setSimulatedBalances(getSimulatedSLPBalances())

    const handlePositionsChange = () => {
      setPositions(getLocalPositions())
    }
    const handlePriceChange = () => {
      setMarketPrice(getSimulatedPrice())
    }
    const handleBalancesChange = () => {
      setSimulatedBalances(getSimulatedSLPBalances())
    }

    window.addEventListener('storage_positions_changed', handlePositionsChange)
    window.addEventListener('storage_price_changed', handlePriceChange)
    window.addEventListener('storage_balances_changed', handleBalancesChange)
    return () => {
      window.removeEventListener('storage_positions_changed', handlePositionsChange)
      window.removeEventListener('storage_price_changed', handlePriceChange)
      window.removeEventListener('storage_balances_changed', handleBalancesChange)
    }
  }, [])

  const addPosition = (
    poolId: string,
    amount0: string,
    amount1: string,
    minPrice: number,
    maxPrice: number,
    hedgeEnabled: boolean,
    hedgeAmount: string
  ) => {
    const newPos: LocalPosition = {
      positionId: 'sim-' + Math.random().toString(36).substr(2, 9),
      poolId,
      tickLower: Math.round(Math.log(minPrice) / Math.log(1.0001)),
      tickUpper: Math.round(Math.log(maxPrice) / Math.log(1.0001)),
      liquidityShares: (parseFloat(amount0 || '0') + parseFloat(amount1 || '0')).toString(),
      amount0,
      amount1,
      hedgeEnabled,
      hedgeAmount,
      strikePrice: marketPrice,
      premiumPaid: hedgeEnabled ? parseFloat(hedgeAmount) * 92.20 : 0, // approx premium
      active: true,
      timestamp: Date.now()
    }

    const updated = [...getLocalPositions(), newPos]
    saveLocalPositions(updated)
    return newPos
  }

  const removePosition = (positionId: string) => {
    const current = getLocalPositions()
    const updated = current.map(p => {
      if (p.positionId === positionId) {
        return { ...p, active: false }
      }
      return p
    })
    saveLocalPositions(updated)
  }

  const deletePosition = (positionId: string) => {
    const current = getLocalPositions()
    const updated = current.filter(p => p.positionId !== positionId)
    saveLocalPositions(updated)
  }

  const updatePrice = (price: number) => {
    saveSimulatedPrice(price)
    setMarketPrice(price)
  }

  return {
    positions,
    marketPrice,
    simulatedBalances,
    addPosition,
    removePosition,
    deletePosition,
    updatePrice,
    refetch: () => {
      setPositions(getLocalPositions())
      setSimulatedBalances(getSimulatedSLPBalances())
    }
  }
}
