import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { GET } from "../flyer/route";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const getUser = vi.fn();
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "member" } } });
  rpc.mockResolvedValue({ data: "dGVzdA==", error: null });
  vi.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
});
describe("private Nodesgiving flyer", () => {
  it("requires a session before retrieving the flyer", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET()).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns decoded image bytes without public caching", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).toBe("test");
  });
  it("handles missing event artwork", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await GET()).status).toBe(404);
  });
  it("does not disclose storage errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private storage detail" } });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private storage detail");
  });
});
