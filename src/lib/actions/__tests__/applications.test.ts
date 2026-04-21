import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    submitApplication,
    prepareVideoUpload,
    linkApplicationVideo,
} from '../applications';
import type { ApplicationFormData } from '@/lib/types/application';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('next/server', () => ({
    after: (fn: () => void | Promise<void>) => {
        Promise.resolve().then(fn).catch(() => {});
    },
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}));

vi.mock('@/lib/google-sheets', () => ({
    appendApplicationToSheet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: vi.fn(),
}));

describe('applications server actions', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockSupabase: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockAdminSupabase: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dedupeLookup: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let appLookup: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let storageBucket: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSupabase = {
            from: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ error: null }),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (createClient as any).mockResolvedValue(mockSupabase);

        // Dedupe chain: .from().select().eq().eq().gte().order().limit().maybeSingle()
        dedupeLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            update: vi.fn().mockReturnThis(),
        };
        appLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'app-id-123' } }),
        };
        storageBucket = {
            createSignedUploadUrl: vi.fn().mockResolvedValue({
                data: { path: 'app-id-123/my-vid.mp4', token: 'signed-token' },
                error: null,
            }),
        };

        mockAdminSupabase = {
            from: vi.fn((table: string) => {
                if (table === 'applications') return dedupeLookup;
                return dedupeLookup;
            }),
            storage: {
                from: vi.fn().mockReturnValue(storageBucket),
            },
        };
        // After select/eq chain for update, terminal .eq resolves
        dedupeLookup.eq.mockImplementation(function impl() {
            // when called as the terminal of .update().eq() → return resolved value
            if (dedupeLookup.update.mock.calls.length > 0) {
                return Promise.resolve({ error: null });
            }
            return dedupeLookup;
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (createAdminClient as any).mockReturnValue(mockAdminSupabase);
    });

    describe('submitApplication', () => {
        it('validates the schema and fails when fields are missing', async () => {
            const data = {
                firstName: '',
                lastName: 'Doe',
            } as unknown as ApplicationFormData;

            const res = await submitApplication(data);
            expect(res).toEqual({ error: 'First name is required' });
            expect(createClient).not.toHaveBeenCalled();
        });

        it('inserts a new application when no duplicate exists', async () => {
            const data = {
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
                yearsAttended: '0 (Virgin Burner)',
            } as unknown as ApplicationFormData;

            const res = await submitApplication(data);
            expect(res).toHaveProperty('id');
            expect(mockSupabase.insert).toHaveBeenCalled();
            const insertCallArgs = mockSupabase.insert.mock.calls[0][0];
            expect(insertCallArgs).toEqual(expect.objectContaining({
                first_name: 'Jane',
                last_name: 'Doe',
                email: 'jane@example.com',
                years_attended: '0 (Virgin Burner)',
            }));
        });

        it('reuses an existing pending application within the dedupe window', async () => {
            dedupeLookup.maybeSingle.mockResolvedValueOnce({ data: { id: 'existing-id' } });

            const data = {
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
                yearsAttended: '1-2',
            } as unknown as ApplicationFormData;

            const res = await submitApplication(data);
            expect(res).toEqual({ id: 'existing-id' });
            expect(mockSupabase.insert).not.toHaveBeenCalled();
            expect(dedupeLookup.update).toHaveBeenCalled();
        });

        it('returns error when insert fails', async () => {
            mockSupabase.insert.mockResolvedValueOnce({ error: { message: 'DB Error' } });

            const data = {
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
                yearsAttended: '1-2',
            } as unknown as ApplicationFormData;

            const res = await submitApplication(data);
            expect(res).toEqual({ error: 'Failed to save draft. Please try again.' });
        });
    });

    describe('prepareVideoUpload', () => {
        beforeEach(() => {
            // Make the .from('applications').select().eq().maybeSingle() chain
            // return an existing app. We wire the admin mock to the appLookup
            // chain specifically for this test group.
            mockAdminSupabase.from = vi.fn().mockReturnValue(appLookup);
        });

        it('rejects files over 200MB', async () => {
            const res = await prepareVideoUpload(
                'app-id-123',
                'big.mp4',
                201 * 1024 * 1024,
                'video/mp4'
            );
            expect(res).toEqual({ error: 'Video must be under 200MB.' });
        });

        it('rejects invalid mime types', async () => {
            const res = await prepareVideoUpload(
                'app-id-123',
                'bad.txt',
                100,
                'text/plain'
            );
            expect(res).toEqual({ error: 'Only MP4, WebM, MOV, and AVI video files are allowed.' });
        });

        it('returns a storage path for a valid file', async () => {
            const res = await prepareVideoUpload(
                'app-id-123',
                'my vid.mp4',
                10 * 1024 * 1024,
                'video/mp4'
            );
            expect(res).toEqual({ path: 'app-id-123/my_vid.mp4' });
        });

        it('returns error when application does not exist', async () => {
            appLookup.maybeSingle.mockResolvedValueOnce({ data: null });
            const res = await prepareVideoUpload(
                'missing-id',
                'my-vid.mp4',
                100,
                'video/mp4'
            );
            expect(res).toEqual({ error: 'Application not found.' });
        });
    });

    describe('linkApplicationVideo', () => {
        it('rejects paths outside the application folder', async () => {
            const res = await linkApplicationVideo('app-id-123', 'other-id/foo.mp4');
            expect(res).toEqual({ error: 'Invalid video path.' });
        });

        it('updates video_url via the admin client', async () => {
            // terminal .eq should resolve after .update()
            const update = vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
            });
            mockAdminSupabase.from = vi.fn().mockReturnValue({ update });

            const res = await linkApplicationVideo('app-id-123', 'app-id-123/my-vid.mp4');
            expect(res).toEqual({ success: true });
            expect(update).toHaveBeenCalledWith({ video_url: 'app-id-123/my-vid.mp4' });
        });
    });
});
