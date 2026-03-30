import { NavLink } from "react-router-dom";

import { primaryRoutes } from "../../constants/routes";

export function Sidebar({
  appName,
  runtimeLabel,
}: {
  appName: string;
  runtimeLabel: string;
}) {
  return (
    <aside className="grid content-start gap-6 border-r border-white/6 bg-[#171717] px-4 py-5">
      <div className="grid gap-1">
        <h1 className="m-0 text-3xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
          {appName}
        </h1>
        <p className="m-0 text-sm text-[#8f8f8f]">{runtimeLabel}</p>
      </div>

      <section className="grid gap-3">
        <nav className="grid gap-1.5" aria-label="primary routes">
          {primaryRoutes.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                [
                  "rounded-2xl border px-3 py-3 transition-colors",
                  isActive
                    ? "border-white/10 bg-[#272727] text-[#f2f2f2]"
                    : "border-transparent bg-white/[0.03] text-[#d4d4d4] hover:border-white/8 hover:bg-white/[0.05] hover:text-[#f2f2f2]",
                ].join(" ")
              }
            >
              <span className="block text-sm">{item.label}</span>
              <span className="mt-1 block text-xs text-[#8f8f8f]">{item.caption}</span>
            </NavLink>
          ))}
        </nav>
      </section>
    </aside>
  );
}
