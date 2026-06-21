import { PreviewProviders } from './providers';

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <PreviewProviders>{children}</PreviewProviders>;
}
