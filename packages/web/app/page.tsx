import { Landing } from '../components/landing';

export const revalidate = 3600;

export default function Home() {
  return <Landing lang="en" />;
}
