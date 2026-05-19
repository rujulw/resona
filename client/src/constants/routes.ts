export const primaryRoutes = [
  { label: "home", path: "/home", caption: "overview", icon: "home" },
  { label: "player", path: "/player", caption: "now playing", icon: "player" },
  { label: "scores", path: "/scores", caption: "sheet music", icon: "scores" },
  { label: "analytics", path: "/analytics", caption: "top plays", icon: "analytics" },
  { label: "settings", path: "/settings", caption: "library paths", icon: "settings" },
] as const;

export const ARTIST_ROUTE_PATTERN = "/artist/:artistName";
export const artistRoute = (name: string) => `/artist/${encodeURIComponent(name)}`;
