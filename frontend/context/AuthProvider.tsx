"use client"

import { createContext, ReactNode, useContext } from 'react'

const AuthContext = createContext<any>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export const useAuth = () => useContext(AuthContext) 