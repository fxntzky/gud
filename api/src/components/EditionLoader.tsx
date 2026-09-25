export function EditionLoader() {
  return (
    <section className="edition-loader" aria-live="polite" aria-label="Loading today’s edition">
      <div className="edition-loader__intro">
        <span>ASSEMBLING TODAY’S EDITION</span>
        <span>A FINITE DAILY SELECTION</span>
      </div>

      {Array.from({ length: 3 }, (_, index) => (
        <div className="edition-loader__story" key={index} aria-hidden="true">
          <div className="edition-loader__media" />
          <div className="edition-loader__copy">
            <div className="edition-loader__meta" />
            <div className="edition-loader__line edition-loader__line--title" />
            <div className="edition-loader__line edition-loader__line--title-short" />
            <div className="edition-loader__line" />
            <div className="edition-loader__line edition-loader__line--short" />
          </div>
        </div>
      ))}
    </section>
  );
}
