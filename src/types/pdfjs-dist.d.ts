// Type declarations to satisfy TS for PDF.js subpath imports
// We only need "any" since we use runtime dynamic imports and call a few known methods

declare module 'pdfjs-dist/legacy/build/pdf' {
  const pdfjsLib: any;
  export = pdfjsLib;
}

declare module 'pdfjs-dist/build/pdf' {
  const pdfjsLib: any;
  export = pdfjsLib;
}
