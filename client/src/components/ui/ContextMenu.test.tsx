// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenu } from "./ContextMenu";

afterEach(cleanup);

function renderMenu(overrides?: Partial<Parameters<typeof ContextMenu>[0]>) {
  const onClose = vi.fn();
  const items = [
    { label: "Play next", onClick: vi.fn() },
    { label: "Add to queue", onClick: vi.fn() },
  ];
  render(
    <ContextMenu
      x={100}
      y={200}
      onClose={onClose}
      items={items}
      {...overrides}
    />,
  );
  return { onClose, items };
}

describe("ContextMenu", () => {
  it("renders all item labels", () => {
    renderMenu();
    expect(screen.getByText("Play next")).toBeTruthy();
    expect(screen.getByText("Add to queue")).toBeTruthy();
  });

  it("calls item onClick and onClose when an item is clicked", () => {
    const { onClose, items } = renderMenu();
    fireEvent.click(screen.getByText("Play next"));
    expect(items[0].onClick).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on Escape keydown", () => {
    const { onClose } = renderMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when clicking outside the menu", () => {
    const { onClose } = renderMenu();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose when clicking inside the menu", () => {
    const { onClose } = renderMenu();
    fireEvent.mouseDown(screen.getByText("Play next"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders optional icon when provided", () => {
    const Icon = ({ className }: { className?: string }) => (
      <svg data-testid="icon" className={className} />
    );
    render(
      <ContextMenu
        x={0}
        y={0}
        onClose={vi.fn()}
        items={[{ label: "Play next", icon: Icon as never, onClick: vi.fn() }]}
      />,
    );
    expect(screen.getByTestId("icon")).toBeTruthy();
  });

  it("positions the menu using fixed style", () => {
    renderMenu();
    const menu = screen.getByText("Play next").closest("[style]");
    expect(menu?.getAttribute("style")).toContain("position: fixed");
  });
});
