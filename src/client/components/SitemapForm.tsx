import { FormEvent, useState } from 'react';

type SitemapFormProps = {
  isLoading: boolean;
  onSubmit: (url: string) => void;
};

export function SitemapForm({ isLoading, onSubmit }: SitemapFormProps) {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUrl = url.trim();

    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS URLs are supported.');
      }
    } catch {
      setValidationError('Enter a valid http or https sitemap URL.');
      return;
    }

    setValidationError(null);
    onSubmit(trimmedUrl);
  }

  return (
    <form className="sitemap-form" onSubmit={handleSubmit}>
      <label htmlFor="sitemap-url">Sitemap URL</label>
      <div className="form-row">
        <input
          id="sitemap-url"
          type="url"
          placeholder="https://example.com/sitemap.xml"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={isLoading}
          required
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Crawling' : 'Explore'}
        </button>
      </div>
      {validationError ? <p className="field-error">{validationError}</p> : null}
    </form>
  );
}
