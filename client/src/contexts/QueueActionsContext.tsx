import { createContext, useContext, useState } from "react";
import { ContextMenu } from "../components/ui/ContextMenu";

type QueueActionsContextValue = {
  onQueueMutate: (trackId: string, mode: "next" | "last") => void;
};

const QueueActionsContext = createContext<QueueActionsContextValue | null>(null);

export function QueueActionsProvider({
  children,
  onQueueMutate,
}: {
  children: React.ReactNode;
  onQueueMutate: (trackId: string, mode: "next" | "last") => void;
}) {
  return (
    <QueueActionsContext.Provider value={{ onQueueMutate }}>
      {children}
    </QueueActionsContext.Provider>
  );
}

export function useQueueActions() {
  return useContext(QueueActionsContext);
}

type TrackContextMenuState = { x: number; y: number; trackId: string } | null;

export function useTrackContextMenu() {
  const ctx = useQueueActions();
  const [menu, setMenu] = useState<TrackContextMenuState>(null);

  const handleContextMenu = (e: React.MouseEvent, trackId: string) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, trackId });
  };

  const contextMenuEl =
    ctx && menu ? (
      <ContextMenu
        x={menu.x}
        y={menu.y}
        onClose={() => setMenu(null)}
        items={[
          { label: "Play next", onClick: () => ctx.onQueueMutate(menu.trackId, "next") },
          { label: "Add to queue", onClick: () => ctx.onQueueMutate(menu.trackId, "last") },
        ]}
      />
    ) : null;

  return { handleContextMenu, contextMenuEl };
}
