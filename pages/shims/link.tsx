// Substitui next/link no build estático: link comum, respeitando o base path do Pages.
import type { AnchorHTMLAttributes } from 'react';

export default function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const base = import.meta.env.BASE_URL ?? '/';
  const url = href.startsWith('/') ? base + href.slice(1) : href;
  return <a href={url} {...rest} />;
}
