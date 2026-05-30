import { useState } from 'react';
import { Sidebar, type NavKey } from './components/sidebar';
import { Content } from './components/content';

export function App() {
  const [active, setActive] = useState<NavKey>('today');

  return (
    <div className="flex h-screen w-screen bg-bg text-text">
      <Sidebar active={active} onSelect={setActive} />
      <Content active={active} />
    </div>
  );
}
