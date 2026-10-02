export const DOCS_EVENT = 'nebula:open-docs';

/** Ask the app to open the documentation viewer at a page (slug or app view id). */
export const openDocs = (slug) => {
  window.dispatchEvent(new CustomEvent(DOCS_EVENT, { detail: { slug } }));
};
