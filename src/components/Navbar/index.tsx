import React from 'react';
import classNames from 'classnames';
import { Link, useLocation } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const { pathname } = useLocation();

  const itemClassName = (path: string) => {
    const isActive = path == pathname;
    return classNames({
      'navbar-item': true,
      'is-active': isActive,
      'is-primary': isActive
    });
  };

  return (
    <nav className="navbar is-spaced" role="navigation" aria-label="main navigation">
      <div className="navbar-brand">
        <Link className="navbar-item" to="/">
          💎
        </Link>
      </div>

      <div id="navbarBasicExample" className="navbar-menu">
        <div className="navbar-start">
          <Link className={itemClassName('/executor')} to="/executor">
            Executor
          </Link>
          <Link className={itemClassName('/visualizer')} to="/visualizer">
            Visualizer
          </Link>
          <Link className={itemClassName('/serializer')} to="/serializer">
            Serializer
          </Link>
        </div>

        <div className="navbar-end">
          <div className="navbar-item">
            <div className="buttons">
              <a className="button is-primary">
                <strong>Connect wallet</strong>
              </a>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
