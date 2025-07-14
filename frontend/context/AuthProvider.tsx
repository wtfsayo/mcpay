"use client"

import { createContext, useContext, ReactNode } from 'react'
import { authClient } from '../lib/auth'

const AuthContext = createContext<any>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export const useAuth = () => useContext(AuthContext) 