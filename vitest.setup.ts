import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

process.env.RESEND_API_KEY ||= 'test_dummy_key'

afterEach(() => {
    cleanup()
})

// Mock generic Next.js features
vi.mock('next/navigation', () => ({
    useRouter() {
        return {
            push: vi.fn(),
            replace: vi.fn(),
            prefetch: vi.fn(),
        }
    },
    usePathname() {
        return ''
    },
}))
