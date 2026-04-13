'use client';

import { useState } from 'react';
import { HelpCircle, X, BookOpen, Play, Rocket, ChevronRight, Search, Monitor, Package, GraduationCap, Users } from 'lucide-react';
import { useTour } from './tour-engine';
import { TOURS } from './tours';

const HELP_ARTICLES = [
  {
    category: 'Getting Started',
    icon: Rocket,
    articles: [
      { title: 'What is Pulse?', content: 'Pulse is Inteliflow\'s school content delivery platform. It syncs educational content (videos, quizzes, documents) to on-prem school nodes so learning works even without internet. The cloud dashboard manages everything; school nodes deliver locally.' },
      { title: 'First-Time Setup', content: '1. Set up Grades & Subjects in Curriculum\n2. Upload video content in Content section\n3. Create a Package bundling your videos\n4. Publish the package and Push Sync\n5. Create a Classroom and generate enrollment codes\n6. Students scan QR code to join and start learning' },
      { title: 'Roles & Permissions', content: 'Super Admin: Full access to all schools and global settings.\nTenant Admin: Manages one organization\'s schools.\nSite Admin: Manages one school site.\nContent Manager: Uploads and manages content.\nTeacher: Views curriculum, results, and conducts classes.\nStudent: Accesses classroom player only.' },
    ],
  },
  {
    category: 'Content & Sync',
    icon: Package,
    articles: [
      { title: 'Uploading Assets', content: 'Go to Content → Assets tab → Upload. Drag and drop files or click to browse. Supported: video (all formats), PDF, images, JSON. Max 4GB per file. Each file gets a SHA-256 checksum for integrity verification.' },
      { title: 'Creating Packages', content: 'A Package bundles multiple assets for delivery. Go to Content → Packages tab → Create Package. Select assets, choose target school sites, and set a version. Packages must be Published before they can be synced.' },
      { title: 'Sync Process', content: 'When you Push Sync, the cloud creates sync jobs for each target node. The sync worker on each node polls every 30 seconds, downloads assets via signed URLs, verifies checksums, and registers them with the local media server. Progress is reported back in real-time.' },
      { title: 'Content Scheduling', content: 'Packages and sequences can have publish_at and expire_at dates. Content auto-publishes at the scheduled time and expires when the date passes.' },
    ],
  },
  {
    category: 'Curriculum',
    icon: GraduationCap,
    articles: [
      { title: 'Setting Up Grades & Subjects', content: 'Go to Curriculum → Grades & Subjects tab. Add your grade levels (Grade 1, Grade 2, etc.) and subjects (Math, Science, English). These are used to organize content and filter what students see.' },
      { title: 'Learning Sequences', content: 'A sequence is an ordered lesson plan. Add items: Video (plays from local media server), Quiz (auto-triggers after video), Document (PDF/resource), Break (pause between sections). Items can auto-advance or require completion.' },
      { title: 'Quiz Builder', content: 'Create quizzes with multiple-choice questions. Set time limits, pass percentage, and whether to show results. Quizzes are delivered inline in the classroom player — no separate app needed.' },
      { title: 'Class Groups', content: 'A Class Group links students to a grade + subject. When a student logs in, they only see sequences assigned to their class groups. Create groups in the Class Groups tab.' },
    ],
  },
  {
    category: 'Classrooms & Devices',
    icon: Monitor,
    articles: [
      { title: 'Creating Classrooms', content: 'Go to Classrooms → Create Classroom. Set name, room code, and assign to a node. The node is the physical appliance at the school that serves content locally.' },
      { title: 'Device Enrollment', content: 'Inside a classroom, click Generate Enrollment Code. This creates a QR code and URL valid for 48 hours. On the student device, open a browser and scan/visit the URL. The device is now enrolled.' },
      { title: 'Teacher Conductor', content: 'Teachers access /conductor?token=... on the school node. Select a sequence and step through it. Every enrolled student device in the classroom auto-advances with the teacher. Students cannot skip ahead while the conductor is active.' },
      { title: 'Offline Mode', content: 'After initial enrollment and content sync, everything works offline. The classroom player, quizzes, video playback — all served locally from the school node. Quiz results are stored locally and synced to cloud when internet returns.' },
    ],
  },
  {
    category: 'Monitoring',
    icon: Search,
    articles: [
      { title: 'Node Health', content: 'Nodes send heartbeats every 60 seconds with CPU, memory, storage, and connectivity data. If no heartbeat for 5 minutes, the node is marked offline. Alerts trigger for high storage (>85%), sustained CPU (>90%), or Jellyfin unreachable.' },
      { title: 'Quiz Results', content: 'Go to Results for quiz analytics: pass rates, score distributions, average scores, and per-student breakdowns. Export to CSV for grade reports.' },
      { title: 'Student Progress', content: 'Go to Progress to see completion rates per sequence, watch time, and student activity. Filter by class group.' },
      { title: 'Audit Log', content: 'Every significant action is logged: node registered, device enrolled, package published, sync completed, user invited. Filter by date and event type. Export to CSV.' },
    ],
  },
];

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'docs' | 'tours'>('docs');
  const tour = useTour();

  const filteredArticles = search.length > 1
    ? HELP_ARTICLES.map((cat) => ({
        ...cat,
        articles: cat.articles.filter((a) =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.content.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((cat) => cat.articles.length > 0)
    : HELP_ARTICLES;

  return (
    <>
      {/* Floating help button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 24, left: 24, zIndex: 999,
          width: 48, height: 48, borderRadius: 999,
          background: '#6366f1', border: 'none', color: '#fff',
          cursor: 'pointer', boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        title="Help & Guides"
      >
        <HelpCircle size={22} />
      </button>

      {/* Help panel */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          display: 'flex', justifyContent: 'flex-end',
        }}>
          {/* Backdrop */}
          <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />

          {/* Panel */}
          <div style={{
            position: 'relative', width: 420, maxWidth: '90vw', height: '100%',
            background: '#0f1117', borderLeft: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={18} style={{ color: '#6366f1' }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb' }}>Help Center</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {(['docs', 'tours'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: activeTab === tab ? '#6366f1' : '#6b7280',
                  borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
                }}>
                  {tab === 'docs' ? 'Documentation' : 'Interactive Tours'}
                </button>
              ))}
            </div>

            {/* Search */}
            {activeTab === 'docs' && (
              <div style={{ padding: '12px 20px' }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search help articles..."
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e5e7eb', fontSize: 13, outline: 'none',
                  }}
                />
              </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
              {activeTab === 'docs' && filteredArticles.map((cat) => (
                <div key={cat.category} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <cat.icon size={14} style={{ color: '#6366f1' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1.5 }}>{cat.category}</span>
                  </div>
                  {cat.articles.map((article) => (
                    <div key={article.title} style={{
                      marginBottom: 4, borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: expandedArticle === article.title ? 'rgba(99,102,241,0.06)' : 'transparent',
                    }}>
                      <button
                        onClick={() => setExpandedArticle(expandedArticle === article.title ? null : article.title)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '12px 14px',
                          background: 'transparent', border: 'none', color: '#e5e7eb',
                          cursor: 'pointer', fontSize: 13, fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        {article.title}
                        <ChevronRight size={14} style={{
                          color: '#6b7280', transition: 'transform 0.2s',
                          transform: expandedArticle === article.title ? 'rotate(90deg)' : 'rotate(0)',
                        }} />
                      </button>
                      {expandedArticle === article.title && (
                        <div style={{ padding: '0 14px 14px', fontSize: 13, lineHeight: 1.8, color: '#9ca3af', whiteSpace: 'pre-line' }}>
                          {article.content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {activeTab === 'tours' && (
                <div style={{ display: 'grid', gap: 10, paddingTop: 8 }}>
                  {Object.entries(TOURS).map(([id, t]) => (
                    <button
                      key={id}
                      onClick={() => { setOpen(false); tour.startTour(id, t.steps); }}
                      style={{
                        textAlign: 'left', padding: 16, borderRadius: 12,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        color: '#e5e7eb', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 14,
                        transition: 'border-color 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Play size={16} style={{ color: '#6366f1' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{t.title}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t.description}</div>
                        <div style={{ fontSize: 11, color: '#6366f1', marginTop: 4 }}>{t.steps.length} steps</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
