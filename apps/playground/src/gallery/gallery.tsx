import { CrabEscape } from "./crab-escape";

export function Gallery() {
  return (
    <section className="demo" aria-labelledby="gallery-title">
      <header className="demo-header">
        <h2 id="gallery-title">Gallery</h2>
        <p>Silly things built on collisions.</p>
      </header>
      <div className="gallery">
        <CrabEscape />
      </div>
    </section>
  );
}
