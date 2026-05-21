import { Navigate, useParams } from "react-router-dom";

import { AlbumDetailPanel } from "../components/ui/AlbumDetailPanel";
import { useAlbumRouteSelection } from "../hooks/albums/useAlbumRouteSelection";
import type { AlbumsState, TracksState } from "../types/app";

export function AlbumsPage({
  albumsState,
  tracksState,
  onAlbumSelect,
  onPlayAlbum,
  onAlbumTrackSelect,
}: {
  albumsState: AlbumsState;
  tracksState: TracksState;
  onAlbumSelect: (albumId: string) => void;
  onPlayAlbum: (albumId: string, startTrackId?: string) => void;
  onAlbumTrackSelect: (trackId: string) => void;
}) {
  const { albumId } = useParams<{ albumId: string }>();

  useAlbumRouteSelection({
    albumId,
    activeAlbumId: albumsState.activeAlbumId,
    albumsStatus: albumsState.status,
    onAlbumSelect,
  });

  if (!albumId && albumsState.items[0]) {
    return <Navigate to={`/albums/${albumsState.items[0].id}`} replace />;
  }

  if (albumsState.status === "loading" && !albumsState.activeAlbum) {
    return (
      <section className="grid h-full place-items-center px-6 py-8">
        <p className="m-0 text-sm text-[#8f8f8f]">Loading album...</p>
      </section>
    );
  }

  if (!albumsState.activeAlbumId && albumsState.items.length === 0) {
    return (
      <section className="grid h-full place-items-center px-6 py-8">
        <div className="grid gap-2 text-center">
          <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">albums</p>
          <h2 className="m-0 text-4xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
            no albums yet
          </h2>
          <p className="m-0 text-sm text-[#8f8f8f]">
            Scan the library to group releases and open album detail views.
          </p>
        </div>
      </section>
    );
  }

  if (albumsState.status !== "loading" && !albumsState.activeAlbum) {
    return (
      <section className="grid h-full place-items-center px-6 py-8">
        <div className="grid gap-2 text-center">
          <h2 className="m-0 text-2xl font-medium text-[#f2f2f2]">album unavailable</h2>
          <p className="m-0 text-sm text-[#8f8f8f]">
            {albumsState.message ?? "The selected album could not be loaded."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <AlbumDetailPanel
      albumDetail={albumsState.activeAlbum}
      activeTrackId={tracksState.selectedTrackId}
      onPlayAlbum={(startTrackId?: string) => {
        if (albumsState.activeAlbumId) {
          onPlayAlbum(albumsState.activeAlbumId, startTrackId);
        }
      }}
      onTrackSelect={onAlbumTrackSelect}
    />
  );
}
