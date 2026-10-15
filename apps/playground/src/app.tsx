import { ContactCards } from "./demos/contact-cards";
import { ImpactGrid } from "./demos/impact-grid";
import { ScrollList } from "./demos/scroll-list";
import { PointerHud } from "./pointer-hud";

export function App() {
  return (
    <>
      <main className="page">
        <header className="hero">
          <h1>kinesia</h1>
          <p className="tagline">A headless toolkit for React.</p>
          <code className="install">npm i kinesia</code>
        </header>
        <ImpactGrid />
        <ContactCards />
        <ScrollList />
      </main>
      <PointerHud />
    </>
  );
}
