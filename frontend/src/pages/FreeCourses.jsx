import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ExternalLink, Search } from 'lucide-react';
import { api, API_ORIGIN } from '../services/api';

export default function FreeCourses() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [resources, setResources] = useState([]);
  const [search, setSearch] = useState('');
  const selectedCategory = searchParams.get('category') || 'All tracks';

  useEffect(() => {
    api.get('/platform/resources/public')
      .then(({ resources: nextResources }) => setResources(nextResources))
      .catch(() => setResources([]));
  }, []);

  const categories = useMemo(() => ['All tracks', ...new Set(resources.map(resource => resource.category))], [resources]);
  const visibleResources = resources.filter(resource => {
    const matchesCategory = selectedCategory === 'All tracks' || resource.category === selectedCategory;
    const searchText = `${resource.title} ${resource.category} ${resource.description || ''}`.toLowerCase();
    return matchesCategory && searchText.includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-[#F4F7F4]">
      <header className="bg-[#0B1F12] text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#8FB89E] text-sm mb-12 hover:text-white"><ArrowLeft size={16} /> Back home</Link>
          <div className="max-w-3xl">
            <p className="text-[#E8B800] text-[10px] font-mono tracking-widest uppercase mb-3">Open learning library</p>
            <h1 className="font-display font-extrabold text-4xl md:text-6xl leading-tight mb-4">Learn the skills Rwanda is building with.</h1>
            <p className="text-[#B8CDBE] leading-relaxed max-w-2xl">Explore free IT courses and practical learning materials for students at every level. Start with a track, then open the resources inside it.</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row gap-3 mb-8">
          <label className="relative flex-1">
            <Search size={17} className="absolute left-3 top-3 text-[#4A6054]" />
            <input className="input pl-10 bg-white" placeholder="Search courses and topics" value={search} onChange={e => setSearch(e.target.value)} />
          </label>
          <select className="input md:w-64 bg-white" value={selectedCategory} onChange={e => navigate(e.target.value === 'All tracks' ? '/free-courses' : `/free-courses?category=${encodeURIComponent(e.target.value)}`)} aria-label="Course track">
            {categories.map(category => <option key={category}>{category}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map(category => (
            <Link key={category} to={category === 'All tracks' ? '/free-courses' : `/free-courses?category=${encodeURIComponent(category)}`} className={`px-3 py-2 rounded-lg text-xs font-mono ${selectedCategory === category ? 'bg-[#0A5C35] text-white' : 'bg-white text-[#4A6054] border border-[#D1DDD5]'}`}>
              {category}
            </Link>
          ))}
        </div>

        {visibleResources.length === 0 && <div className="bg-white border border-[#D1DDD5] rounded-xl p-10 text-center text-[#4A6054]">No courses match this search yet.</div>}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleResources.map(resource => (
            <article key={resource.id} className="bg-white border border-[#D1DDD5] rounded-xl p-6 flex flex-col">
              <div className="w-10 h-10 rounded-lg bg-[#0A5C35]/10 flex items-center justify-center mb-5"><BookOpen size={18} className="text-[#0A5C35]" /></div>
              <p className="text-[#0A5C35] text-[10px] font-mono uppercase tracking-widest mb-2">{resource.category}</p>
              <h2 className="font-display font-bold text-[#0D1F13] text-xl mb-2">{resource.title}</h2>
              <p className="text-[#4A6054] text-sm leading-relaxed flex-1">{resource.description}</p>
              <div className="flex gap-4 mt-6 text-sm">
                {resource.file_path && <a className="text-[#0A5C35] underline" href={`${API_ORIGIN}${resource.file_path}`} target="_blank" rel="noreferrer">Download</a>}
                {resource.resource_url && <a className="inline-flex items-center gap-1 text-[#0A5C35] underline" href={resource.resource_url} target="_blank" rel="noreferrer">Open course <ExternalLink size={13} /></a>}
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
