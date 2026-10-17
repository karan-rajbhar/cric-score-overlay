import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ usePathname: () => "/matches/m1/score" }));

const allowRegistration = vi.hoisted(() => ({ value: false }));
vi.mock("~/lib/pwa/service-worker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/pwa/service-worker")>();
  return {
    ...actual,
    // jsdom runs as "test" on http://localhost; let a test pretend otherwise.
    shouldRegisterServiceWorker: (env: Parameters<typeof actual.shouldRegisterServiceWorker>[0]) =>
      allowRegistration.value || actual.shouldRegisterServiceWorker(env),
    removeServiceWorkers: vi.fn(async () => false),
    cacheCurrentPage: vi.fn(async () => undefined),
  };
});

import { ServiceWorkerRegistrar } from "./service-worker-registrar";
import { removeServiceWorkers } from "~/lib/pwa/service-worker";
import { enqueueAction } from "~/lib/offline-queue";

function installServiceWorker(reg: Partial<ServiceWorkerRegistration>) {
  const register = vi.fn(async () => reg as ServiceWorkerRegistration);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register,
      controller: {},
      ready: new Promise(() => undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  return register;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  allowRegistration.value = false;
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("ServiceWorkerRegistrar", () => {
  it("never registers outside production; removes stale workers instead", async () => {
    const register = installServiceWorker({});
    render(<ServiceWorkerRegistrar />);
    await act(async () => undefined);
    expect(register).not.toHaveBeenCalled();
    expect(removeServiceWorkers).toHaveBeenCalled();
  });

  it("registers the versioned worker in production", async () => {
    allowRegistration.value = true;
    const register = installServiceWorker({ addEventListener: vi.fn() });
    render(<ServiceWorkerRegistrar />);
    await act(async () => undefined);
    expect(register).toHaveBeenCalledWith(expect.stringMatching(/^\/sw\.js\?v=/), {
      scope: "/",
      updateViaCache: "none",
    });
  });

  it("offers a waiting update only once queued actions have synced", async () => {
    vi.useFakeTimers();
    allowRegistration.value = true;
    enqueueAction("m1", "setBowler", { bowlerId: "b1" } as never);
    const postMessage = vi.fn();
    installServiceWorker({ waiting: { postMessage } as never, addEventListener: vi.fn() });

    render(<ServiceWorkerRegistrar />);
    await act(async () => undefined);
    expect(toast).not.toHaveBeenCalled();

    localStorage.clear(); // the queue synced
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(toast).toHaveBeenCalledWith(
      "New version available",
      expect.objectContaining({ id: "sw-update" }),
    );
    expect(postMessage).not.toHaveBeenCalled();

    // Reload asks the waiting worker to take over.
    const { action } = toast.mock.calls[0]![1] as {
      action: { onClick: () => void };
    };
    action.onClick();
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });
});
