import { FormEvent, useState } from 'react';

import type { CrawlOptions } from '../../shared/types.js';
import { CONFIGURABLE_CRAWL_OPTION_MAXIMUMS } from '../../shared/types.js';
import { CRAWL_PRESETS, type AdvancedCrawlFields, type CrawlPresetId, buildCrawlOptions } from '../crawlOptions.js';

type SitemapFormProps = {
  isLoading: boolean;
  onSubmit: (url: string, options: CrawlOptions) => void;
};

function createEmptyAdvancedFields(): AdvancedCrawlFields {
  return {
    maxDepth: '',
    maxSitemaps: '',
    maxUrls: '',
    maxRequestsPerSecond: '',
  };
}

const advancedFieldLabels: AdvancedCrawlFields = {
  maxDepth: 'Max depth',
  maxSitemaps: 'Max sitemaps',
  maxUrls: 'Max URLs',
  maxRequestsPerSecond: 'Requests / sec',
};

export function SitemapForm({ isLoading, onSubmit }: SitemapFormProps) {
  const [url, setUrl] = useState('');
  const [presetId, setPresetId] = useState<CrawlPresetId>('standard');
  const [advancedFields, setAdvancedFields] = useState<AdvancedCrawlFields>(() => createEmptyAdvancedFields());
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
    onSubmit(trimmedUrl, buildCrawlOptions(presetId, advancedFields));
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
      <fieldset className="crawl-presets" disabled={isLoading}>
        <legend>Crawl profile</legend>
        <div className="preset-grid">
          {Object.entries(CRAWL_PRESETS).map(([id, preset]) => (
            <label className={`preset-option${presetId === id ? ' is-selected' : ''}`} key={id}>
              <input
                type="radio"
                name="crawl-preset"
                value={id}
                checked={presetId === id}
                onChange={() => {
                  setPresetId(id as CrawlPresetId);
                  setAdvancedFields(createEmptyAdvancedFields());
                }}
              />
              <span>{preset.label}</span>
              <small>{preset.description}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <details className="advanced-crawl-options">
        <summary>Advanced crawl limits</summary>
        <div className="advanced-grid">
          {(Object.keys(advancedFieldLabels) as Array<keyof AdvancedCrawlFields>).map((key) => (
            <label key={key}>
              <span>{advancedFieldLabels[key]}</span>
              <input
                type="number"
                min="1"
                max={CONFIGURABLE_CRAWL_OPTION_MAXIMUMS[key]}
                step="1"
                inputMode="numeric"
                placeholder={CRAWL_PRESETS[presetId].options[key].toLocaleString()}
                value={advancedFields[key]}
                onChange={(event) => setAdvancedFields((current) => ({ ...current, [key]: event.target.value }))}
                disabled={isLoading}
              />
            </label>
          ))}
        </div>
      </details>
      {validationError ? <p className="field-error">{validationError}</p> : null}
    </form>
  );
}
