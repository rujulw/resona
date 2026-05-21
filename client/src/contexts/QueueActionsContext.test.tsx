// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueueActionsProvider, useTrackContextMenu } from "./QueueActionsContext";

afterEach(cleanup);

function TestConsumer({ trackId }: { trackId: string }) {
  const { handleContextMenu, contextMenuEl } = useTrackContextMenu();
  return (
    <>
      {contextMenuEl}
      <div
        data-testid="target"
        onContextMenu={(e) => handleContextMenu(e, trackId)}
      />
    </>
  );
}

function renderWithProvider(onQueueMutate = vi.fn(), trackId = "track-1") {
  render(
    <QueueActionsProvider onQueueMutate={onQueueMutate}>
      <TestConsumer trackId={trackId} />
    </QueueActionsProvider>,
  );
  return { onQueueMutate };
}

describe("QueueActionsContext", () => {
  it("does not render context menu before right-click", () => {
    renderWithProvider();
    expect(screen.queryByText("Play next")).toBeNull();
  });

  it("shows context menu after right-click on target", () => {
    renderWithProvider();
    fireEvent.contextMenu(screen.getByTestId("target"));
    expect(screen.getByText("Play next")).toBeTruthy();
    expect(screen.getByText("Add to queue")).toBeTruthy();
  });

  it("calls onQueueMutate with 'next' when Play next is clicked", () => {
    const { onQueueMutate } = renderWithProvider(vi.fn(), "abc");
    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Play next"));
    expect(onQueueMutate).toHaveBeenCalledWith("abc", "next");
  });

  it("calls onQueueMutate with 'last' when Add to queue is clicked", () => {
    const { onQueueMutate } = renderWithProvider(vi.fn(), "abc");
    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Add to queue"));
    expect(onQueueMutate).toHaveBeenCalledWith("abc", "last");
  });

  it("dismisses context menu after item click", () => {
    renderWithProvider();
    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Play next"));
    expect(screen.queryByText("Play next")).toBeNull();
  });

  it("does not render context menu when provider is absent", () => {
    function Bare() {
      const { handleContextMenu, contextMenuEl } = useTrackContextMenu();
      return (
        <>
          {contextMenuEl}
          <div
            data-testid="bare"
            onContextMenu={(e) => handleContextMenu(e, "t1")}
          />
        </>
      );
    }
    render(<Bare />);
    fireEvent.contextMenu(screen.getByTestId("bare"));
    expect(screen.queryByText("Play next")).toBeNull();
  });
});
