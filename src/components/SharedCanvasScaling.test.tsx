import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, act } from "@testing-library/react";
import { SharedCanvas } from "./SharedCanvas";
import { useRoomStore } from "../store/roomStore";

// Mock canvas 2D context methods to track drawing math
const mockBeginPath = vi.fn();
const mockMoveTo = vi.fn();
const mockLineTo = vi.fn();
const mockStroke = vi.fn();
const mockClearRect = vi.fn();
const mockScale = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    beginPath: mockBeginPath,
    moveTo: mockMoveTo,
    lineTo: mockLineTo,
    stroke: mockStroke,
    clearRect: mockClearRect,
    scale: mockScale,
  }) as any;
});

describe("SharedCanvas Point Scaling & Normalization", () => {
  it("should draw lines by scaling normalized fractional points back to local pixels", async () => {
    // 1. Setup a mocked line with fractional/normalized coordinates [0.25, 0.1, 0.75, 0.9]
    // representing a diagonal stroke across varying screen sizes.
    const mockLine = {
      id: "line-abc",
      points: [0.25, 0.1, 0.75, 0.9],
      color: "#000000",
      strokeWidth: 4,
      tool: "pen",
    };

    // Initialize roomStore and merge elements
    act(() => {
      useRoomStore.getState().reset();
      useRoomStore.getState().mergeCanvasElements([mockLine]);
    });

    // 2. Render SharedCanvas component
    // We mock dimensions container offsetWidth to set local width = 800px, height = 480px
    const containerMock = {
      get offsetWidth() {
        return 800;
      }
    };

    // Spy on getBoundingClientRect & offsetWidth
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1024);

    const { container } = render(
      <SharedCanvas isHost={true} socket={null} isDark={false} />
    );

    // Force offsetWidth mockup on the element
    const containerDiv = container.firstChild as HTMLDivElement;
    Object.defineProperty(containerDiv, "offsetWidth", {
      value: 800,
      writable: true,
    });

    // Fire resize/redraw effects
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Redraw effect triggers on lines state or dimensions change.
    // Check if moveTo was called with scaled values:
    // startX = 0.25 * 800 = 200px
    // startY = 0.1 * 400 (height capped at 400px) = 40px
    // nextX = 0.75 * 800 = 600px
    // nextY = 0.9 * 400 = 360px
    expect(mockMoveTo).toHaveBeenCalledWith(200, 40);
    expect(mockLineTo).toHaveBeenCalledWith(600, 360);
    expect(mockStroke).toHaveBeenCalled();
  });
});
