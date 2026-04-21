/**
 * Authentication Configuration
 * =============================
 * NextAuth.js configuration with credentials and optional Google OAuth
 */

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    // Credentials Provider (Email/Password)
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'email@example.com',
        },
        password: {
          label: 'Password',
          type: 'password',
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: {
            employees: {
              select: {
                id: true,
                employeeId: true,
              },
            },
          },
        })

        if (!user || !user.password) {
          throw new Error('Invalid email or password')
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error('Invalid email or password')
        }

        // Return user object with role and employee info
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
          employeeId: user.employees[0]?.employeeId ?? null,
        }
      },
    }),

    // Google OAuth Provider (Optional)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in - add user data to token
      if (user) {
        token.id = user.id
        token.role = user.role
        token.employeeId = user.employeeId ?? null
      }

      // Handle session updates
      if (trigger === 'update' && session) {
        token.name = session.name
        token.role = session.role
      }

      return token
    },

    async session({ session, token }) {
      // Add token data to session
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.employeeId = token.employeeId as string | null
      }
      return session
    },

    async signIn({ user, account }) {
      // For OAuth providers, check if user exists
      if (account?.provider !== 'credentials') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })
        if (!existingUser) {
          // Create new user with default role
          await prisma.user.create({
            data: {
              email: user.email!,
              username: user.email!,
              name: user.name,
              image: user.image,
              role: 'EMPLOYEE',
            },
          })
        }
      }
      return true
    },
  },

  events: {
    async signIn({ user }) {
      console.log(`User signed in: ${user.email}`)
    },
    async signOut({ token }) {
      console.log(`User signed out: ${token?.email}`)
    },
  },

  debug: process.env.NODE_ENV === 'development',
}

// Extend NextAuth types for custom session properties
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string | null
      role: string
      image?: string | null
      employeeId: string | null
    }
  }

  interface User {
    role: string
    employeeId?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    employeeId: string | null
  }
}