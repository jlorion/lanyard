import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="container page-narrow not-found">
      <p className="eyebrow">404</p>
      <h1 className="h2">This page doesn't exist.</h1>
      <p className="lead">It may have moved when the docs were reorganised.</p>
      <p className="not-found-links">
        <Link to="/" className="btn btn-primary btn-lg">
          Home
        </Link>
        <Link to="/docs/" className="btn btn-secondary btn-lg">
          Documentation
        </Link>
      </p>
    </div>
  );
}
