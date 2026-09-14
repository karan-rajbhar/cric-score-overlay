import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventStings } from "./event-stings";
import type { ActiveEventSting } from "./types";

describe("EventStings Component", () => {
  it("renders null when sting is null", () => {
    const { container } = render(
      <EventStings sting={null} onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders FOUR! sting correctly", () => {
    const sting: ActiveEventSting = {
      id: "test-4",
      type: "four",
      title: "FOUR!",
      subtitle: "Virat Kohli cracks a boundary",
      detail: "78* (46b)",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} onDismiss={vi.fn()} />);
    expect(screen.getByText("FOUR!")).toBeInTheDocument();
    expect(
      screen.getByText("Virat Kohli cracks a boundary"),
    ).toBeInTheDocument();
    expect(screen.getByText("78* (46b)")).toBeInTheDocument();
  });

  it("renders MAXIMUM! sting correctly", () => {
    const sting: ActiveEventSting = {
      id: "test-6",
      type: "six",
      title: "MAXIMUM!",
      subtitle: "Massive six over long-on",
      detail: "84* (47b)",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} onDismiss={vi.fn()} />);
    expect(screen.getByText("MAXIMUM!")).toBeInTheDocument();
    expect(screen.getByText("THAT'S A HUGE SIX!")).toBeInTheDocument();
    expect(screen.getByText("Massive six over long-on")).toBeInTheDocument();
  });

  it("renders WICKET! sting with dismissal details", () => {
    const sting: ActiveEventSting = {
      id: "test-w",
      type: "wicket",
      title: "WICKET!",
      subtitle: "Faf du Plessis OUT",
      detail: "c Dhoni b Jadeja",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} onDismiss={vi.fn()} />);
    expect(screen.getByText("WICKET!")).toBeInTheDocument();
    expect(screen.getByText("Faf du Plessis OUT")).toBeInTheDocument();
    expect(screen.getByText("c Dhoni b Jadeja")).toBeInTheDocument();
  });

  it("renders MILESTONE! sting correctly", () => {
    const sting: ActiveEventSting = {
      id: "test-m",
      type: "milestone",
      title: "FANTASTIC FIFTY!",
      subtitle: "Virat Kohli · 50 Runs",
      detail: "Off 32 deliveries",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} onDismiss={vi.fn()} />);
    expect(screen.getByText("FANTASTIC FIFTY!")).toBeInTheDocument();
    expect(screen.getByText("Virat Kohli · 50 Runs")).toBeInTheDocument();
    expect(screen.getByText("Off 32 deliveries")).toBeInTheDocument();
  });

  it("renders FREE HIT! sting correctly", () => {
    const sting: ActiveEventSting = {
      id: "test-fh",
      type: "free_hit",
      title: "FREE HIT!",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} onDismiss={vi.fn()} />);
    expect(screen.getByText("FREE HIT!")).toBeInTheDocument();
    expect(
      screen.getByText(/No Dismissals Except Run Out/i),
    ).toBeInTheDocument();
  });

  it("renders Fox Cricket telemetry HUD sting when theme is foxcricket", () => {
    const sting: ActiveEventSting = {
      id: "test-fox-4",
      type: "four",
      title: "FOUR!",
      subtitle: "David Warner cuts for four",
      detail: "148.4 km/h",
      durationMs: 4000,
    };

    render(
      <EventStings sting={sting} theme="foxcricket" onDismiss={vi.fn()} />,
    );
    expect(
      screen.getByText(/FOX CRICKET · FOX SPORTS LAB/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/RADAR EXIT: 148.4 KM\/H/i)).toBeInTheDocument();
    expect(screen.getByText("FOUR!")).toBeInTheDocument();
    expect(screen.getByText("FOX SPEED")).toBeInTheDocument();
  });

  it("renders Sony Sports Network curved pill sting when theme is sonysports", () => {
    const sting: ActiveEventSting = {
      id: "test-sony-4",
      type: "four",
      title: "FOUR!",
      subtitle: "Rohit Sharma drives",
      detail: "Cracking cover drive",
      durationMs: 4000,
    };

    render(
      <EventStings sting={sting} theme="sonysports" onDismiss={vi.fn()} />,
    );
    expect(
      screen.getByText(/SONY SPORTS NETWORK · LIVE STREAMING ON SONY LIV/i),
    ).toBeInTheDocument();
    expect(screen.getByText("FOUR!")).toBeInTheDocument();
    expect(screen.getByText("SONY LIV")).toBeInTheDocument();
  });

  it("renders Sky Sports Ashes architectural sting when theme is skysports", () => {
    const sting: ActiveEventSting = {
      id: "test-sky-4",
      type: "four",
      title: "FOUR!",
      subtitle: "Joe Root drives through covers",
      detail: "4 runs to the boundary",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} theme="skysports" onDismiss={vi.fn()} />);
    expect(screen.getByText("sky sports cricket")).toBeInTheDocument();
    expect(screen.getByText("THE ASHES LIVE")).toBeInTheDocument();
    expect(screen.getByText("FOUR!")).toBeInTheDocument();
  });

  it("renders The Hundred pop-art sting when theme is thehundred", () => {
    const sting: ActiveEventSting = {
      id: "test-100-4",
      type: "four",
      title: "FOUR!",
      subtitle: "Liam Livingstone smashes",
      detail: "Boundary struck",
      durationMs: 4000,
    };

    render(
      <EventStings sting={sting} theme="thehundred" onDismiss={vi.fn()} />,
    );
    expect(
      screen.getByText(/THE HUNDRED · BALLS COUNTDOWN CRICKET/i),
    ).toBeInTheDocument();
    expect(screen.getByText("FOUR!")).toBeInTheDocument();
  });

  it("renders Apex 24k Gold Franchise sting when theme is apex", () => {
    const sting: ActiveEventSting = {
      id: "test-apex-4",
      type: "four",
      title: "FOUR!",
      subtitle: "Sanju Samson sweeps",
      detail: "144.2 km/h",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} theme="apex" onDismiss={vi.fn()} />);
    expect(
      screen.getByText(/APEX BROADCAST · 24K GOLD BOUNDARY/i),
    ).toBeInTheDocument();
    expect(screen.getByText("APEX 4!")).toBeInTheDocument();
    expect(screen.getByText("EXIT SPEED")).toBeInTheDocument();
  });

  it("renders Volt Sports-Tech cyber neon sting when theme is volt", () => {
    const sting: ActiveEventSting = {
      id: "test-volt-4",
      type: "four",
      title: "FOUR!",
      subtitle: "Andre Russell blitzes",
      detail: "151.2 km/h",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} theme="volt" onDismiss={vi.fn()} />);
    expect(
      screen.getByText(/VOLT SPORTS-TECH · HIGH-VOLTAGE BOUNDARY/i),
    ).toBeInTheDocument();
    expect(screen.getByText("FOUR!")).toBeInTheDocument();
    expect(screen.getByText("VOLT RADAR")).toBeInTheDocument();
  });

  it("renders Thunder Velocity cobalt storm sting when theme is thunder", () => {
    const sting: ActiveEventSting = {
      id: "test-thunder-4",
      type: "four",
      title: "FOUR!",
      subtitle: "Glenn Maxwell reverse sweeps",
      detail: "139.8 km/h",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} theme="thunder" onDismiss={vi.fn()} />);
    expect(
      screen.getByText(/THUNDER VELOCITY · LIGHTNING FOUR/i),
    ).toBeInTheDocument();
    expect(screen.getByText("FOUR!")).toBeInTheDocument();
    expect(screen.getByText("THUNDER SPEED")).toBeInTheDocument();
  });

  it("renders Dharma Heritage royale sting when theme is dharma", () => {
    const sting: ActiveEventSting = {
      id: "test-dharma-4",
      type: "four",
      title: "FOUR!",
      subtitle: "KL Rahul classic cover drive",
      detail: "Exquisite timing",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} theme="dharma" onDismiss={vi.fn()} />);
    expect(
      screen.getByText(/DHARMA HERITAGE · ROYAL BOUNDARY/i),
    ).toBeInTheDocument();
    expect(screen.getByText("FOUR!")).toBeInTheDocument();
    expect(screen.getByText("SHAHI SHOT")).toBeInTheDocument();
  });

  it("renders Nakshatra Astral cosmic sting when theme is nakshatra", () => {
    const sting: ActiveEventSting = {
      id: "test-nakshatra-4",
      type: "four",
      title: "FOUR!",
      subtitle: "Suryakumar Yadav scoops",
      detail: "360 degree boundary",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} theme="nakshatra" onDismiss={vi.fn()} />);
    expect(
      screen.getByText(/NAKSHATRA ASTRAL · STELLAR BOUNDARY/i),
    ).toBeInTheDocument();
    expect(screen.getByText("FOUR!")).toBeInTheDocument();
    expect(screen.getByText("ASTRAL METRICS")).toBeInTheDocument();
  });

  it("renders Agni Inferno volcanic magma sting when theme is agni", () => {
    const sting: ActiveEventSting = {
      id: "test-agni-4",
      type: "four",
      title: "BLAZING 4!",
      subtitle: "Rishabh Pant one-handed blast",
      detail: "148.5 km/h",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} theme="agni" onDismiss={vi.fn()} />);
    expect(
      screen.getByText(/AGNI INFERNO · BLAZING BOUNDARY/i),
    ).toBeInTheDocument();
    expect(screen.getByText("BLAZING 4!")).toBeInTheDocument();
    expect(screen.getByText("EXIT HEAT")).toBeInTheDocument();
  });

  it("renders Agni Inferno maximum volcanic blast for six when theme is agni", () => {
    const sting: ActiveEventSting = {
      id: "test-agni-6",
      type: "six",
      title: "MAXIMUM 6!",
      subtitle: "Out of the stadium",
      detail: "116 metres",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} theme="agni" onDismiss={vi.fn()} />);
    expect(
      screen.getByText(/AGNI INFERNO · MAXIMUM VOLCANIC BLAST/i),
    ).toBeInTheDocument();
    expect(screen.getByText("MAXIMUM 6!")).toBeInTheDocument();
    expect(screen.getByText("BALL TRAJECTORY")).toBeInTheDocument();
  });
});
