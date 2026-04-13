'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronRight, Rocket, School, Package, Monitor, BookOpen, BarChart3 } from 'lucide-react';

interface WizardStep {
  icon: any;
  title: string;
  description: string;
  action: string;
  href: string;
  completed?: boolean;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    icon: School,
    title: 'Set Up Your School',
    description: 'Create grades, subjects, and terms in the Curriculum section. This is the foundation for organizing content by class.',
    action: 'Go to Curriculum',
    href: '/dashboard/school/curriculum',
  },
  {
    icon: Package,
    title: 'Upload Your First Content',
    description: 'Upload video lessons or documents in the Content section. Then create a Package to bundle them together.',
    action: 'Go to Content',
    href: '/dashboard/content',
  },
  {
    icon: BookOpen,
    title: 'Create a Learning Sequence',
    description: 'Build a sequence: video → quiz → video. Students will follow this flow automatically in the classroom player.',
    action: 'Go to Sequences',
    href: '/dashboard/school/curriculum',
  },
  {
    icon: Monitor,
    title: 'Enroll a Classroom',
    description: 'Create a classroom, assign it to a node, and generate enrollment codes. Devices scan the QR code to join.',
    action: 'Go to Classrooms',
    href: '/dashboard/school/classrooms',
  },
  {
    icon: Rocket,
    title: 'Publish & Sync',
    description: 'Publish your package, then hit Push Sync. The sync worker will deliver content to your school node automatically.',
    action: 'Go to Content',
    href: '/dashboard/content',
  },
  {
    icon: BarChart3,
    title: 'Monitor & Review',
    description: 'Check the Monitoring dashboard for node health, sync progress, and student activity. Review quiz results in the Results page.',
    action: 'Go to Monitoring',
    href: '/dashboard/monitoring',
  },
];

export function OnboardingWizard() {
  const [show, setShow] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const dismissed = localStorage.getItem('pulse_onboarding_dismissed');
    const completed = localStorage.getItem('pulse_onboarding_completed');
    if (!dismissed && !completed) {
      // Show after a short delay so the dashboard loads first
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!show) return null;

  const step = WIZARD_STEPS[currentStep];
  const Icon = step.icon;

  function dismiss() {
    localStorage.setItem('pulse_onboarding_dismissed', 'true');
    setShow(false);
  }

  function complete() {
    localStorage.setItem('pulse_onboarding_completed', 'true');
    setShow(false);
  }

  function goToStep() {
    router.push(step.href);
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      complete();
    }
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
      width: 380, maxWidth: 'calc(100vw - 48px)',
      background: '#1e2130', border: '1px solid rgba(99,102,241,0.3)',
      borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(236,72,153,0.1))',
        padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Rocket size={16} style={{ color: '#6366f1' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb' }}>Getting Started</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{currentStep + 1}/{WIZARD_STEPS.length}</span>
          <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 2 }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.05)' }}>
        <div style={{
          height: '100%', background: '#6366f1', transition: 'width 0.3s',
          width: `${((currentStep + 1) / WIZARD_STEPS.length) * 100}%`,
        }} />
      </div>

      {/* Content */}
      <div style={{ padding: 20 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'rgba(99,102,241,0.15)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <Icon size={22} style={{ color: '#6366f1' }} />
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 6px 0' }}>{step.title}</h3>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: '#9ca3af', margin: '0 0 16px 0' }}>{step.description}</p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={goToStep} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 16px', borderRadius: 10, background: '#6366f1', border: 'none',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            {step.action} <ChevronRight size={14} />
          </button>
          {currentStep < WIZARD_STEPS.length - 1 && (
            <button onClick={() => setCurrentStep(currentStep + 1)} style={{
              padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', fontSize: 13,
              cursor: 'pointer', fontWeight: 600,
            }}>
              Skip
            </button>
          )}
        </div>
      </div>

      {/* Step dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '0 20px 16px' }}>
        {WIZARD_STEPS.map((_, i) => (
          <button key={i} onClick={() => setCurrentStep(i)} style={{
            width: 8, height: 8, borderRadius: 999, border: 'none', cursor: 'pointer',
            background: i === currentStep ? '#6366f1' : i < currentStep ? '#10b981' : 'rgba(255,255,255,0.1)',
            transition: 'all 0.2s',
          }} />
        ))}
      </div>
    </div>
  );
}

// Button to re-open the wizard
export function ShowOnboardingButton() {
  const handleClick = () => {
    localStorage.removeItem('pulse_onboarding_dismissed');
    localStorage.removeItem('pulse_onboarding_completed');
    window.location.reload();
  };

  return (
    <button onClick={handleClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
      background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
      color: '#6366f1', fontSize: 12, cursor: 'pointer', fontWeight: 600,
    }}>
      <Rocket size={12} /> Restart Setup Guide
    </button>
  );
}
