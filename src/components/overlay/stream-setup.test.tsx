import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("~/lib/firebase/client", () => ({ getFirebaseDb: () => ({}) }));
vi.mock("~/lib/firebase/realtime", () => ({ watchDoc: () => () => {} }));
vi.mock("~/app/overlay/sponsor-actions", () => ({
  getMatchSponsors: vi.fn(async () => ({
    source: null,
    sourceId: null,
    sponsors: [],
  })),
}));
vi.mock("~/components/streaming/channel-picker", () => ({
  ChannelPicker: () => <div data-testid="channel-picker" />,
}));
vi.mock("./sound-effects", () => ({
  playFourFanfare: vi.fn(),
  playSixExplosion: vi.fn(),
  playWicketTone: vi.fn(),
  playMilestoneFanfare: vi.fn(),
  playFreeHitAlert: vi.fn(),
}));

import {
  DEMO_MATCH_DETAILS,
  DEMO_MATCH_STATE,
} from "~/app/overlay/[matchId]/demo-data";
import { StreamSetup } from "./stream-setup";

class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
}

const URL = "https://cricscore.example.com/overlay/m1";
const fetchMock = vi.fn();

function setup(canProduce: boolean) {
  return render(
    <StreamSetup
      matchId="m1"
      overlayUrl={URL}
      qrDataUrl="data:image/png;base64,AAAA"
      canProduce={canProduce}
      state={DEMO_MATCH_STATE}
      match={DEMO_MATCH_DETAILS}
    />,
  );
}

beforeEach(() => {
  window.ResizeObserver =
    MockResizeObserver as unknown as typeof ResizeObserver;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("StreamSetup", () => {
  it("walks through the chosen tool's steps and the OBS fields", () => {
    setup(false);
    expect(
      screen.getByText("Set Width to 1920 and Height to 1080, then click OK."),
    ).toBeInTheDocument();
    expect(screen.getByText("Custom CSS")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /PRISM Live Studio/ }));
    expect(screen.getByText(/Add a web widget/)).toBeInTheDocument();
    // The OBS-only field list goes with OBS.
    expect(screen.queryByText("Custom CSS")).toBeNull();
  });

  it("copies the clean overlay link and shows its QR code", async () => {
    setup(false);
    expect(screen.getByLabelText("Overlay link")).toHaveValue(URL);
    expect(
      screen.getByAltText("QR code of the overlay link"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(URL),
    );
    expect(
      await screen.findByRole("button", { name: "Copied" }),
    ).toBeInTheDocument();
  });

  it("lets only the match's scorers and streamers change the overlay", () => {
    setup(false);
    expect(screen.queryByTestId("channel-picker")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Send test graphic" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: /^Light/ })).toBeDisabled();
    expect(screen.queryByRole("link", { name: /run the graphics/ })).toBeNull();
  });

  it("sends a test graphic and the choice of who runs the graphics", async () => {
    setup(true);
    // A ground's fixed link, for producers.
    expect(screen.getByTestId("channel-picker")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send test graphic" }));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toMatchObject({
      matchId: "m1",
      payload: {
        type: "SHOW_STRAP",
        strap: { type: "custom", title: "Your overlay is working" },
      },
    });
    fireEvent.click(screen.getByRole("link", { name: /run the graphics/ }));
    const auto = JSON.parse(fetchMock.mock.calls[1]![1].body as string).payload;
    expect(auto.type).toBe("SET_AUTO");
    expect(
      Object.values(auto.auto).every((r) => !(r as { on: boolean }).on),
    ).toBe(true);
  });
});
