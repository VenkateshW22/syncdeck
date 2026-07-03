import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PersonalNotesPanel } from "./PersonalNotesPanel";

// Mock the custom hooks
const mockInsertSmartAction = vi.fn();
const mockExportNotes = vi.fn();
const mockSetContent = vi.fn();
const mockSetSearchQuery = vi.fn();

vi.mock("../hooks/usePersonalNotes", () => {
  return {
    usePersonalNotes: () => ({
      content: "Initial notes text content",
      setContent: mockSetContent,
      lastSaved: new Date("2026-07-03T10:00:00Z"),
      searchQuery: "",
      setSearchQuery: mockSetSearchQuery,
      insertSmartAction: mockInsertSmartAction,
      exportNotes: mockExportNotes,
    }),
  };
});

const mockActivePoll = {
  question: "What is 2+2?",
  options: ["4", "5"],
};
const mockCurrentAction = {
  type: "POLL",
  title: "Active Poll",
  description: "What is 2+2?",
  primaryCta: "Vote Now",
};

vi.mock("../hooks/useNextAction", () => {
  return {
    useNextAction: () => ({
      currentAction: mockCurrentAction,
      activePoll: mockActivePoll,
    }),
  };
});

describe("PersonalNotesPanel Smart Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render notes editor UI with current content", () => {
    render(<PersonalNotesPanel roomId="room-123" resources={[]} />);
    expect(screen.getByText("Personal Notes")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Initial notes text content")).toBeInTheDocument();
  });

  it("should open smart actions dropdown and insert current poll format on click", () => {
    render(<PersonalNotesPanel roomId="room-123" resources={[]} />);
    
    // Find and click Wand icon button to open smart actions
    const wandButton = screen.getByTitle("Smart Actions");
    fireEvent.click(wandButton);

    // Verify dropdown items
    expect(screen.getByText("Current Poll")).toBeInTheDocument();
    expect(screen.getByText("Latest Resource")).toBeInTheDocument();
    expect(screen.getByText("New Topic Header")).toBeInTheDocument();

    // Click on "Current Poll" to trigger insertion
    fireEvent.click(screen.getByText("Current Poll"));

    // Check that insertSmartAction was called with properly formatted markdown string
    expect(mockInsertSmartAction).toHaveBeenCalledWith(
      "\n### Poll: What is 2+2?\n- [ ] 4\n- [ ] 5"
    );
  });

  it("should insert latest resource details on smart action click", () => {
    const mockResources = [
      {
        id: "res-1",
        title: "Drizzle Docs",
        url: "https://orm.drizzle.team",
        type: "URL_RESOURCE",
      },
    ];

    render(<PersonalNotesPanel roomId="room-123" resources={mockResources} />);
    
    const wandButton = screen.getByTitle("Smart Actions");
    fireEvent.click(wandButton);

    fireEvent.click(screen.getByText("Latest Resource"));

    expect(mockInsertSmartAction).toHaveBeenCalledWith(
      "\n### Resource: Drizzle Docs\nLink: https://orm.drizzle.team"
    );
  });

  it("should insert new topic header template on click", () => {
    render(<PersonalNotesPanel roomId="room-123" resources={[]} />);
    
    const wandButton = screen.getByTitle("Smart Actions");
    fireEvent.click(wandButton);

    fireEvent.click(screen.getByText("New Topic Header"));

    expect(mockInsertSmartAction).toHaveBeenCalledWith(
      "\n### Current Topic: \n\n"
    );
  });
});
