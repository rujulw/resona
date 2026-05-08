export const primaryRoutes = [
  { label: "home", path: "/home", caption: "overview", icon: "home" },
  { label: "tracks", path: "/tracks", caption: "library table", icon: "tracks" },
  { label: "queue", path: "/queue", caption: "play next", icon: "queue" },
  { label: "settings", path: "/settings", caption: "library paths", icon: "settings" },
] as const;

export const ARTIST_ROUTE_PATTERN = "/artist/:artistName";
export const artistRoute = (name: string) => `/artist/${encodeURIComponent(name)}`;
