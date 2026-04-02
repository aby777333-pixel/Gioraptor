'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { GraduationCap, BookOpen, ChevronRight, Play } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { cn } from '@/lib/utils/format';

const CATEGORY_COLORS: Record<string, string> = {
  beginner: 'bg-profit/15 text-profit',
  intermediate: 'bg-gold/15 text-gold',
  advanced: 'bg-loss/15 text-loss',
  strategy: 'bg-accent/15 text-accent',
};

export default function EducationPage() {
  const [courses, setCourses] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('education_courses')
        .select('*, education_lessons(id, title, duration_minutes, sort_order)')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

      setCourses(data ?? []);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-bold text-foreground">Education Hub</h1>
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground">Education Hub</h1>
        <p className="text-xs text-secondary mt-0.5">Master the markets with structured courses</p>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No courses available"
          description="Educational content will be available here soon."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const lessons = (course.education_lessons as Record<string, unknown>[]) ?? [];
            const lessonCount = lessons.length;
            const progress = (course.progress_pct as number) ?? 0;
            const expanded = expandedCourse === (course.id as string);
            const category = (course.category as string) ?? 'beginner';

            return (
              <div key={course.id as string} className="rounded-xl border border-border bg-elevated flex flex-col">
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold capitalize', CATEGORY_COLORS[category] ?? 'bg-surface text-muted')}>
                      {category}
                    </span>
                    <span className="text-[10px] text-muted">{lessonCount} lessons</span>
                  </div>

                  <h3 className="text-sm font-semibold text-foreground">{course.title as string}</h3>
                  <p className="text-[10px] text-secondary line-clamp-2">{course.description as string}</p>

                  <ProgressBar value={progress} label="Progress" size="sm" />

                  <button
                    onClick={() => setExpandedCourse(expanded ? null : (course.id as string))}
                    className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
                  >
                    {expanded ? 'Hide Lessons' : 'View Lessons'}
                    <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
                  </button>
                </div>

                {expanded && lessons.length > 0 && (
                  <div className="border-t border-border px-4 py-3 space-y-1.5">
                    {[...lessons]
                      .sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0))
                      .map((lesson, i) => (
                        <div
                          key={lesson.id as string}
                          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface/50 transition-colors cursor-pointer"
                        >
                          <div className="flex h-5 w-5 items-center justify-center rounded bg-surface text-[10px] font-medium text-muted shrink-0">
                            {i + 1}
                          </div>
                          <span className="text-xs text-foreground flex-1 truncate">{lesson.title as string}</span>
                          <span className="text-[10px] text-muted shrink-0">
                            {(lesson.duration_minutes as number) ?? 5}m
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
