'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { X, ChevronRight, ChevronLeft, HelpCircle } from 'lucide-react';

export interface TourStep {
  target?: string;       // CSS selector for the element to highlight
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;   // Run when step is shown
}

interface TourContextType {
  startTour: (id: string, steps: TourStep[]) => void;
  endTour: () => void;
  isActive: boolean;
  currentTourId: string | null;
}

const TourContext = createContext<TourContextType>({
  startTour: () => {},
  endTour: () => {},
  isActive: false,
  currentTourId: null,
});

export function useTour() {
  return useContext(TourContext);
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [currentTourId, setCurrentTourId] = useState<string | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const startTour = useCallback((id: string, tourSteps: TourStep[]) => {
    setCurrentTourId(id);
    setSteps(tourSteps);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    setSteps([]);
    setCurrentStep(0);
    if (currentTourId) {
      localStorage.setItem(`pulse_tour_${currentTourId}`, 'completed');
    }
    setCurrentTourId(null);
  }, [currentTourId]);

  // Find and highlight the target element
  useEffect(() => {
    if (!isActive || !steps[currentStep]) { setTargetRect(null); return; }

    const step = steps[currentStep];
    if (step.action) step.action();

    if (!step.target) { setTargetRect(null); return; }

    const findTarget = () => {
      const el = document.querySelector(step.target!);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setTargetRect(null);
      }
    };

    findTarget();
    const interval = setInterval(findTarget, 500);
    return () => clearInterval(interval);
  }, [isActive, currentStep, steps]);

  const next = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
    else endTour();
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const step = steps[currentStep];

  return (
    <TourContext.Provider value={{ startTour, endTour, isActive, currentTourId }}>
      {children}

      {isActive && step && (
        <>
          {/* Overlay */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none' }}>
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
              <defs>
                <mask id="tour-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {targetRect && (
                    <rect
                      x={targetRect.left - 8}
                      y={targetRect.top - 8}
                      width={targetRect.width + 16}
                      height={targetRect.height + 16}
                      rx={12}
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#tour-mask)" style={{ pointerEvents: 'auto' }} onClick={endTour} />
            </svg>
          </div>

          {/* Tooltip */}
          <div
            style={{
              position: 'fixed',
              zIndex: 9999,
              ...(targetRect && step.position !== 'center' ? getTooltipPosition(targetRect, step.position ?? 'bottom') : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
              maxWidth: 400,
              width: 'calc(100vw - 32px)',
            }}
          >
            <div style={{
              background: '#1e2130',
              border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.2)',
              color: '#e5e7eb',
            }}>
              {/* Progress dots */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {steps.map((_, i) => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: 999,
                      background: i === currentStep ? '#6366f1' : i < currentStep ? '#10b981' : 'rgba(255,255,255,0.15)',
                      transition: 'all 0.3s',
                    }} />
                  ))}
                </div>
                <button onClick={endTour} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4 }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
                Step {currentStep + 1} of {steps.length}
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>{step.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: '#9ca3af', margin: '0 0 20px 0' }}>{step.content}</p>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                <button
                  onClick={prev}
                  disabled={currentStep === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                    color: currentStep === 0 ? '#4b5563' : '#e5e7eb', cursor: currentStep === 0 ? 'default' : 'pointer',
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <button
                  onClick={next}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '8px 18px', borderRadius: 8,
                    background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  {currentStep === steps.length - 1 ? 'Finish' : 'Next'} <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </TourContext.Provider>
  );
}

function getTooltipPosition(rect: DOMRect, position: string): React.CSSProperties {
  const gap = 16;
  switch (position) {
    case 'top': return { bottom: window.innerHeight - rect.top + gap, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' };
    case 'left': return { top: rect.top + rect.height / 2, right: window.innerWidth - rect.left + gap, transform: 'translateY(-50%)' };
    case 'right': return { top: rect.top + rect.height / 2, left: rect.right + gap, transform: 'translateY(-50%)' };
    default: return { top: rect.bottom + gap, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' };
  }
}
