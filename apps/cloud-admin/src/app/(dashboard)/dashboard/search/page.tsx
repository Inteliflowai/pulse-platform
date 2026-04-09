'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Server, Package, Monitor, Users, BookOpen, FileText } from 'lucide-react';

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: any;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }

    setLoading(true);
    const term = `%${q}%`;
    const found: SearchResult[] = [];

    // Search nodes
    const { data: nodes } = await supabase.from('nodes').select('id, name, hostname, status').ilike('name', term).limit(5);
    for (const n of nodes ?? []) {
      found.push({ type: 'Node', id: n.id, title: n.name, subtitle: `${n.status} — ${n.hostname ?? ''}`, href: `/dashboard/global/nodes/${n.id}`, icon: Server });
    }

    // Search packages
    const { data: pkgs } = await supabase.from('packages').select('id, name, version, status').ilike('name', term).limit(5);
    for (const p of pkgs ?? []) {
      found.push({ type: 'Package', id: p.id, title: p.name, subtitle: `v${p.version} — ${p.status}`, href: `/dashboard/content/packages/${p.id}`, icon: Package });
    }

    // Search assets
    const { data: assets } = await supabase.from('assets').select('id, filename, mime_type, status').ilike('filename', term).limit(5);
    for (const a of assets ?? []) {
      found.push({ type: 'Asset', id: a.id, title: a.filename, subtitle: `${a.mime_type ?? ''} — ${a.status}`, href: '/dashboard/content', icon: FileText });
    }

    // Search users
    const { data: users } = await supabase.from('users').select('id, email, full_name, role').or(`email.ilike.${term},full_name.ilike.${term}`).limit(5);
    for (const u of users ?? []) {
      found.push({ type: 'User', id: u.id, title: u.full_name ?? u.email, subtitle: u.role, href: '/dashboard/school/users', icon: Users });
    }

    // Search classrooms
    const { data: rooms } = await supabase.from('classrooms').select('id, name, room_code').ilike('name', term).limit(5);
    for (const r of rooms ?? []) {
      found.push({ type: 'Classroom', id: r.id, title: r.name, subtitle: r.room_code ?? '', href: `/dashboard/school/classrooms/${r.id}`, icon: Monitor });
    }

    // Search sequences
    const { data: seqs } = await supabase.from('learning_sequences').select('id, name, status').ilike('name', term).limit(5);
    for (const s of seqs ?? []) {
      found.push({ type: 'Sequence', id: s.id, title: s.name, subtitle: s.status, href: `/dashboard/school/curriculum/sequences/${s.id}`, icon: BookOpen });
    }

    // Search quizzes
    const { data: quizzes } = await supabase.from('quiz_definitions').select('id, title, status').ilike('title', term).limit(5);
    for (const q of quizzes ?? []) {
      found.push({ type: 'Quiz', id: q.id, title: q.title, subtitle: q.status, href: '/dashboard/school/curriculum', icon: BookOpen });
    }

    setResults(found);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search nodes, packages, assets, users, classrooms, sequences..."
          className="pl-10 h-12 text-base"
          autoFocus
        />
      </div>

      {loading && <p className="text-gray-500 text-center py-8">Searching...</p>}

      {!loading && query.length >= 2 && results.length === 0 && (
        <p className="text-gray-500 text-center py-8">No results for "{query}"</p>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{results.length} result(s)</CardTitle></CardHeader>
          <CardContent className="p-0">
            {results.map((r) => (
              <Link key={`${r.type}-${r.id}`} href={r.href} className="flex items-center gap-3 px-4 py-3 border-b border-gray-700 hover:bg-brand-surface transition-colors last:border-0">
                <r.icon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{r.title}</p>
                  <p className="text-xs text-gray-500 truncate">{r.subtitle}</p>
                </div>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">{r.type}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
