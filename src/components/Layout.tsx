import { NavLink, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <>
      <div className="app-shell">
        <Outlet />
      </div>
      <nav className="tabbar">
        <NavLink to="/" end>
          ホーム
        </NavLink>
        <NavLink to="/history">履歴</NavLink>
        <NavLink to="/advice">提案</NavLink>
        <NavLink to="/settings">設定</NavLink>
      </nav>
    </>
  );
}
