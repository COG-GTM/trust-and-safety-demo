import { NavLink, Outlet } from "react-router-dom";

const NAV_ITEMS: Array<{ to: string; label: string }> = [
  { to: "/", label: "Overview" },
  { to: "/flagged", label: "Flagged events" },
  { to: "/rules", label: "Rule metrics" },
  { to: "/labels", label: "Labels" },
  { to: "/pipeline", label: "Pipeline health" },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Osprey</h1>
        <small>Executive dashboard</small>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            {item.label}
          </NavLink>
        ))}
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
