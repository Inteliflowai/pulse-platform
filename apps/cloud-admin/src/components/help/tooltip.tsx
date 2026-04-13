'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  text: string;
  children?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function HelpTooltip({ text, children, position = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false);

  const posStyles: Record<string, React.CSSProperties> = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8 },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 },
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children ?? <HelpCircle size={14} style={{ color: '#6b7280', cursor: 'help' }} />}
      {show && (
        <div style={{
          position: 'absolute', ...posStyles[position], zIndex: 50,
          background: '#1e2130', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10,
          padding: '8px 12px', fontSize: 12, color: '#d1d5db', whiteSpace: 'normal',
          width: 220, lineHeight: 1.6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {text}
        </div>
      )}
    </span>
  );
}
