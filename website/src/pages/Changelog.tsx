import { changelog } from '../lib/markdown';
import { Prose } from './Docs';

export function Changelog() {
  return (
    <div className="container page-narrow">
      <Prose html={changelog().html} />
    </div>
  );
}
