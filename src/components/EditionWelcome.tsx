import type { NewsEdition } from '../types/news';

interface EditionWelcomeProps {
  onSelect: (edition: NewsEdition) => void;
}

export function EditionWelcome({ onSelect }: EditionWelcomeProps) {
  return (
    <section className="language-welcome" aria-labelledby="edition-welcome-title">
      <div className="language-welcome__frame">
        <div className="language-welcome__topline">
          <span>GUD · DAILY GOOD NEWS</span>
          <span>SELECT YOUR EDITION</span>
        </div>

        <div className="language-welcome__center">
          <p className="language-welcome__eyebrow">WELCOME TO</p>
          <h1 id="edition-welcome-title">GUD</h1>
          <p className="language-welcome__prompt">Choose your edition</p>

          <div className="language-welcome__choices" aria-label="Choose GUD edition">
            <button type="button" onClick={() => onSelect('english')}>
              <span>GUD English</span>
              <small>EN</small>
            </button>

            <button type="button" onClick={() => onSelect('latam')}>
              <span>GUD Hispanoamérica</span>
              <small>ES-419</small>
            </button>
          </div>
        </div>

        <div className="language-welcome__bottom">
          <span>Original-language sources</span>
          <span>Two independent editions</span>
        </div>
      </div>
    </section>
  );
}
