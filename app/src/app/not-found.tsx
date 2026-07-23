import { NotFoundContent } from "@/components/NotFoundContent";

/*
 * Static 404 (AD-13): `output: 'export'` emits out/404.html from this file
 * and Netlify serves it for unknown URLs — no redirects, no functions. It
 * renders inside the root layout, so it inherits the chrome shell.
 */
export default function NotFound() {
  return <NotFoundContent />;
}
