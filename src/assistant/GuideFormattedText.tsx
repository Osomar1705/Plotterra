import type { ReactNode } from 'react';

/** Renders a constrained Markdown subset as React nodes, never injected HTML. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    return part;
  });
}

export function GuideFormattedText({ text }: {text: string}) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    blocks.push(<ul key={`list-${blocks.length}`}>{bullets.map((item, i) => <li key={i}>{inline(item)}</li>)}</ul>);
    bullets = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flush(); continue; }
    const match = trimmed.match(/^(?:[-*•]\s+|\d+[.)]\s+)(.+)$/);
    if (match) { bullets.push(match[1]); continue; }
    flush();
    if (trimmed.startsWith('### ')) blocks.push(<h4 key={blocks.length}>{inline(trimmed.slice(4))}</h4>);
    else blocks.push(<p key={blocks.length}>{inline(trimmed.replace(/^#{1,2}\s+/, ''))}</p>);
  }
  flush();
  return <div className="guide-rich-text">{blocks}</div>;
}
