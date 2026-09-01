import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronRight, BookOpen, Clock } from 'lucide-react';
import { useCourse } from '../context/CourseContext';

const DifficultyBadge = ({ level }) => {
  const colors = {
    beginner: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    intermediate: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    advanced: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[level] || colors.beginner}`}>
      {level}
    </span>
  );
};

export default function CourseListing() {
  const navigate = useNavigate();
  const { courses, fetchCourses, loading } = useCourse();
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchCourses({ search, language, difficulty });
  }, [language, difficulty]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCourses({ search, language, difficulty });
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/learn')}
            className="text-xs text-white/40 hover:text-white/60 mb-3 block"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-white mb-1">Courses</h1>
          <p className="text-white/50 text-sm">Browse all available courses</p>
        </div>

        {/* Search & Filters */}
        <div className="mb-6 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search courses..."
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/30"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/50 hover:bg-white/[0.06] transition-colors flex items-center gap-2 text-sm"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </form>

          {showFilters && (
            <div className="flex flex-wrap gap-3 p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg">
              <div>
                <label className="text-xs text-white/30 block mb-1">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-white/[0.05] border border-white/[0.08] rounded px-3 py-1.5 text-sm text-white focus:outline-none"
                >
                  <option value="">All</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/30 block mb-1">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="bg-white/[0.05] border border-white/[0.08] rounded px-3 py-1.5 text-sm text-white focus:outline-none"
                >
                  <option value="">All</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              {(language || difficulty) && (
                <button
                  onClick={() => { setLanguage(''); setDifficulty(''); }}
                  className="self-end text-xs text-cyan-400 hover:text-cyan-300"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Course Grid */}
        {loading ? (
          <div className="text-center py-20 text-white/30 text-sm">Loading courses...</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-white/20 text-3xl mb-3">📚</div>
            <div className="text-white/40 text-sm mb-2">No courses found</div>
            <div className="text-white/30 text-xs">Try adjusting your filters</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <button
                key={course._id}
                onClick={() => navigate(`/learn/course/${course._id}`)}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 text-left hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-white font-semibold text-sm group-hover:text-cyan-400 transition-colors">
                    {course.title}
                  </h3>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-cyan-400 transition-colors shrink-0 mt-0.5" />
                </div>
                <p className="text-white/40 text-xs mb-3 line-clamp-2">{course.description}</p>
                <div className="flex items-center gap-2 mb-3">
                  <DifficultyBadge level={course.difficulty} />
                  <span className="text-white/30 text-xs bg-white/5 px-2 py-0.5 rounded">{course.language}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/30">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {course.totalLessons} lessons
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ~{course.estimatedMinutes}m
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
