import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { HallOfFameDialog } from "./hall-of-fame-dialog";
import { inductHallOfFame } from "~/app/clubs/actions";
import { toast } from "sonner";

vi.mock("~/app/clubs/actions", () => ({
  inductHallOfFame: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("~/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (val: string) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="mock-select-root">
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child, { value, onValueChange } as Record<string, unknown>)
          : child
      )}
    </div>
  ),
  SelectTrigger: ({
    id,
    children,
  }: {
    id?: string;
    children: React.ReactNode;
  }) => (
    <div data-testid={`mock-select-trigger-${id ?? "default"}`}>
      {children}
    </div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder ?? "Select value"}</span>
  ),
  SelectContent: ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode;
    onValueChange?: (val: string) => void;
  }) => (
    <div data-testid="mock-select-content">
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child, { onValueChange } as Record<string, unknown>)
          : child
      )}
    </div>
  ),
  SelectItem: ({
    value,
    children,
    onValueChange,
  }: {
    value: string;
    children: React.ReactNode;
    onValueChange?: (val: string) => void;
  }) => (
    <button
      type="button"
      data-testid={`mock-select-item-${value}`}
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </button>
  ),
}));

describe("HallOfFameDialog Component", () => {
  const mockMembers = [
    { id: "usr-1", name: "Sachin Tendulkar" },
    { id: "usr-2", name: "MS Dhoni" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Induct Legend trigger button", () => {
    render(<HallOfFameDialog clubId="club-10" members={mockMembers} />);

    expect(
      screen.getByRole("button", { name: /induct legend/i })
    ).toBeInTheDocument();
  });

  it("opens modal dialog and displays form fields", () => {
    render(<HallOfFameDialog clubId="club-10" members={mockMembers} />);

    fireEvent.click(screen.getByRole("button", { name: /induct legend/i }));

    expect(
      screen.getByRole("heading", { name: /hall of fame induction/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Sachin Tendulkar")).toBeInTheDocument();
    expect(screen.getByText("MS Dhoni")).toBeInTheDocument();
    expect(screen.getByLabelText(/honor \/ title/i)).toBeInTheDocument();
  });

  it("validates that a member is selected before submitting", async () => {
    render(<HallOfFameDialog clubId="club-10" members={mockMembers} />);

    fireEvent.click(screen.getByRole("button", { name: /induct legend/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm induction/i }));

    expect(toast.error).toHaveBeenCalledWith("Please select a player to induct");
    expect(inductHallOfFame).not.toHaveBeenCalled();
  });

  it("validates that title is entered before submitting", async () => {
    render(<HallOfFameDialog clubId="club-10" members={mockMembers} />);

    fireEvent.click(screen.getByRole("button", { name: /induct legend/i }));

    // Select player
    fireEvent.click(screen.getByTestId("mock-select-item-usr-1"));

    // Click confirm without title
    fireEvent.click(screen.getByRole("button", { name: /confirm induction/i }));

    expect(toast.error).toHaveBeenCalledWith("Please provide an induction title or honor");
    expect(inductHallOfFame).not.toHaveBeenCalled();
  });

  it("submits valid induction details and displays success toast", async () => {
    vi.mocked(inductHallOfFame).mockResolvedValueOnce({ success: true } as never);

    render(<HallOfFameDialog clubId="club-10" members={mockMembers} />);

    fireEvent.click(screen.getByRole("button", { name: /induct legend/i }));

    // Select player and category
    fireEvent.click(screen.getByTestId("mock-select-item-usr-1"));
    fireEvent.click(screen.getByTestId("mock-select-item-top_scorer"));

    // Fill textual fields
    fireEvent.change(screen.getByLabelText(/honor \/ title/i), {
      target: { value: "Master Blaster" },
    });
    fireEvent.change(screen.getByLabelText(/record metric/i), {
      target: { value: "15,921 Test runs" },
    });
    fireEvent.change(screen.getByLabelText(/season \/ era/i), {
      target: { value: "1989-2013" },
    });
    fireEvent.change(screen.getByLabelText(/citation \/ description/i), {
      target: { value: "Greatest batsman in history." },
    });

    fireEvent.click(screen.getByRole("button", { name: /confirm induction/i }));

    await waitFor(() => {
      expect(inductHallOfFame).toHaveBeenCalledWith("club-10", {
        playerId: "usr-1",
        category: "top_scorer",
        title: "Master Blaster",
        description: "Greatest batsman in history.",
        seasonOrYear: "1989-2013",
        recordMetric: "15,921 Test runs",
      });
      expect(toast.success).toHaveBeenCalledWith("Player inducted into the Hall of Fame!");
    });
  });

  it("handles error returned by server action", async () => {
    vi.mocked(inductHallOfFame).mockResolvedValueOnce({
      error: "Member is already inducted",
    } as never);

    render(<HallOfFameDialog clubId="club-10" members={mockMembers} />);

    fireEvent.click(screen.getByRole("button", { name: /induct legend/i }));
    fireEvent.click(screen.getByTestId("mock-select-item-usr-2"));
    fireEvent.change(screen.getByLabelText(/honor \/ title/i), {
      target: { value: "Captain Cool" },
    });

    fireEvent.click(screen.getByRole("button", { name: /confirm induction/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Member is already inducted");
    });
  });

  it("handles exception during induction", async () => {
    vi.mocked(inductHallOfFame).mockRejectedValueOnce(new Error("Network disconnect"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<HallOfFameDialog clubId="club-10" members={mockMembers} />);

    fireEvent.click(screen.getByRole("button", { name: /induct legend/i }));
    fireEvent.click(screen.getByTestId("mock-select-item-usr-2"));
    fireEvent.change(screen.getByLabelText(/honor \/ title/i), {
      target: { value: "Captain Cool" },
    });

    fireEvent.click(screen.getByRole("button", { name: /confirm induction/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to induct player");
    });
    consoleSpy.mockRestore();
  });
});
