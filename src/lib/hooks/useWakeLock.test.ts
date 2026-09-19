import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWakeLock } from "./useWakeLock";

describe("useWakeLock hook", () => {
  let mockSentinel: { release: ReturnType<typeof vi.fn>; addEventListener: ReturnType<typeof vi.fn> };
  let requestMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSentinel = {
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    };
    requestMock = vi.fn().mockResolvedValue(mockSentinel);

    Object.defineProperty(navigator, "wakeLock", {
      value: {
        request: requestMock,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requests wake lock when enabled is true", async () => {
    const { result } = renderHook(() => useWakeLock(true));

    await act(async () => {
      // allow promise resolution
      await Promise.resolve();
    });

    expect(requestMock).toHaveBeenCalledWith("screen");
    expect(result.current.isLocked).toBe(true);
  });

  it("does not request wake lock when enabled is false", () => {
    const { result } = renderHook(() => useWakeLock(false));

    expect(requestMock).not.toHaveBeenCalled();
    expect(result.current.isLocked).toBe(false);
  });

  it("releases wake lock on unmount", async () => {
    const { unmount } = renderHook(() => useWakeLock(true));

    await act(async () => {
      await Promise.resolve();
    });

    unmount();
    expect(mockSentinel.release).toHaveBeenCalledTimes(1);
  });

  it("gracefully handles absence of navigator.wakeLock", () => {
    Object.defineProperty(navigator, "wakeLock", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useWakeLock(true));
    expect(result.current.isLocked).toBe(false);
    expect(result.current.isSupported).toBe(false);
  });
});
