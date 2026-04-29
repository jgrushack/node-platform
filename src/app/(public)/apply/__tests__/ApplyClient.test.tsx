import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ApplyClient from '../apply-client';

// Mock server actions
vi.mock('@/lib/actions/applications', () => ({
    submitApplication: vi.fn(),
    createDraftApplication: vi.fn(),
    finalizeApplication: vi.fn(),
    prepareVideoUpload: vi.fn(),
    linkApplicationVideo: vi.fn(),
}));


describe('ApplyClient Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the Welcome step initially', () => {
        render(<ApplyClient />);
        expect(screen.getByText(/Apply to/i)).toBeInTheDocument();
        expect(screen.getByText(/We want to get to know you/i)).toBeInTheDocument();
    });

    it('should progress to the Personal step when Continue is clicked', async () => {
        render(<ApplyClient />);

        // There shouldn't be "First Name *" input yet
        expect(screen.queryByPlaceholderText(/Jane/i)).not.toBeInTheDocument();

        // Click continue
        const continueBtn = screen.getByRole('button', { name: /Continue/i });
        fireEvent.click(continueBtn);

        // Now it should show Personal Step (use findBy to await the animation)
        expect(await screen.findByPlaceholderText(/Jane/i)).toBeInTheDocument();
        expect(await screen.findByPlaceholderText(/Doe/i)).toBeInTheDocument();
        expect(await screen.findByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    });

    it('should validate required fields on the Personal step', async () => {
        render(<ApplyClient />);

        // Welcome -> Personal
        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

        // Wait for Personal step animation
        await screen.findByPlaceholderText(/Jane/i);

        // Currently on Personal, try to skip
        const continueBtn = screen.getByRole('button', { name: /Continue/i });
        fireEvent.click(continueBtn);

        // Since we didn't fill it out, we should NOT see the Experience step yet.
        // The Experience step opens with "Have you been to Burning Man before?"
        expect(screen.queryByText(/Have you been to Burning Man before/i)).not.toBeInTheDocument();

        // Fill out the fields
        fireEvent.change(screen.getByPlaceholderText(/Jane/i), { target: { value: 'Jane' } });
        fireEvent.change(screen.getByPlaceholderText(/Doe/i), { target: { value: 'Doe' } });
        fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'jane@example.com' } });

        // Now click continue
        fireEvent.click(continueBtn);

        // Now we should see the Experience step
        expect(await screen.findByText(/Have you been to Burning Man before/i)).toBeInTheDocument();
    });
});
