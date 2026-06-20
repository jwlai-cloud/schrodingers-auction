// Allow TypeScript to understand CSS side-effect imports (e.g. globals.css in layout.tsx).
// Next.js handles these at build time; this shim stops tsc from complaining.
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}
