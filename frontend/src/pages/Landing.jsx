 import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Users, BarChart3, Code2, Network, Cpu, Globe,
  ChevronRight, Menu, X, Play, Brain, Target, Layers, ArrowRight, Check,
  Shield, Wifi, Database, Layout,
  GraduationCap, Building2, FlaskConical,
  MapPin, ChevronDown, Sparkles
} from 'lucide-react';

// ─── Data ───────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Learning', href: '#learning' },
  { label: 'For Schools', href: '#schools' },
  { label: 'Pricing', href: '#pricing' },
];

const STATS = [
  { label: 'Schools & Universities', icon: Building2 },
  { label: 'Active Students', icon: GraduationCap },
  { label: 'Projects Completed', icon: Target },
  { label: 'Free Courses', icon: BookOpen },
];

const PILLARS = [
  {
    icon: Layers,
    title: 'Project Management',
    desc: 'GitHub-style repos, Trello-style boards, milestone tracking, and code review — all in one workspace built for students.',
    color: 'bg-[#0A5C35]',
    tag: 'Core',
    href: '/student/kanban',
    detailKey: 'projects',
  },
  {
    icon: Play,
    title: 'Live Learning',
    desc: 'Host and join live classes, record sessions, take quizzes, submit assignments, and track your academic progress.',
    color: 'bg-[#1a7a4a]',
    tag: 'LMS',
    href: '/free-courses',
    detailKey: 'learning',
  },
  {
    icon: Brain,
    title: 'AI Tutor',
    desc: "IMBONI AI is always on — ask it to explain concepts, review your code, suggest resources, or debug your project. Available 24/7.",
    color: 'bg-[#0d4a2a]',
    tag: 'AI',
    href: '/student/ai-tutor',
    detailKey: 'ai',
  },
  {
    icon: Users,
    title: 'Team Spaces',
    desc: 'Form cross-school teams, assign roles, track who does what, and celebrate milestones together — locally or across Rwanda.',
    color: 'bg-[#083b22]',
    tag: 'Collaboration',
    href: '/register',
    detailKey: 'teams',
  },
];

const FEATURE_TABS = {
  projects: {
    headline: 'Full project lifecycle, one workspace',
    body: 'From idea to deployment — manage your entire project lifecycle the way professional developers do. IMBONI brings together version control concepts, kanban boards, sprint planning, and code collaboration tools in a student-friendly environment.',
    items: [
      'Kanban and sprint boards with drag-and-drop tasks',
      'Milestone and deadline tracking with progress bars',
      'Peer code review and inline feedback',
      'Git-style project repositories and history',
      'File sharing, documentation, and wikis',
      'Cross-school project collaboration',
    ],
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=500&fit=crop&auto=format',
    imageAlt: 'Student working on project at laptop',
  },
  learning: {
    headline: 'Every course you need, completely free',
    body: 'IMBONI Learning gives every Rwandan student access to a world-class curriculum — from basic networking to advanced web development — taught by verified lecturers and industry professionals. No fees, no barriers.',
    items: [
      'Live and recorded lectures with interactive transcripts',
      'Quizzes, assignments, and automated grading',
      'Progress certificates and achievement badges',
      'Note sharing and collaborative study groups',
      'Offline-accessible course materials',
      'Curriculum aligned with TVET and university syllabi',
    ],
    image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=500&fit=crop&auto=format',
    imageAlt: 'Student in class at laptop',
  },
  teams: {
    headline: 'Build together across any school in Rwanda',
    body: 'IMBONI Teams removes geographic barriers. A student in Kigali can co-lead a project with a classmate in Musanze. Schools can collaborate on national-scale initiatives. Real teams, real outcomes.',
    items: [
      'Cross-school and cross-city team formation',
      'Role-based access: Lead, Developer, Designer, Reviewer',
      'Team activity feed and notification hub',
      'Shared file vault and version history',
      'Team analytics: contribution heatmaps',
      'End-of-project showcase and portfolio export',
    ],
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=500&fit=crop&auto=format',
    imageAlt: 'Team of students collaborating on project',
  },
  ai: {
    headline: 'Your always-on academic companion',
    body: "IMBONI AI understands Rwandan curricula, knows your current courses, and can see your project context. It's not a generic chatbot — it's a tutor that knows where you are in your studies and helps you move forward.",
    items: [
      'Code review and bug explanation in plain language',
      'Concept explanations tied to your current course',
      'Essay and report feedback with specific suggestions',
      'Study plan generation based on deadlines',
      'Diagram and architecture suggestions',
      'Available in English, French, and Kinyarwanda',
    ],
    image: 'https://images.unsplash.com/photo-1620712014386-a46db6717435?w=800&h=500&fit=crop',
    imageAlt: 'AI technology and neural networks',
  },
};

const TRACKS = [
  { icon: Code2, label: 'Software Development', category: 'Programming', color: '#0A5C35' },
  { icon: Network, label: 'Networking & CCNA', category: 'Networking', color: '#1a7a4a' },
  { icon: Cpu, label: 'Computer Systems', category: 'Systems', color: '#0d4a2a' },
  { icon: Database, label: 'Database Administration', category: 'Data and Databases', color: '#083b22' },
  { icon: Globe, label: 'Web Development', category: 'Programming', color: '#0A5C35' },
  { icon: Shield, label: 'Cybersecurity', category: 'Cybersecurity', color: '#1a7a4a' },
  { icon: Layout, label: 'UI/UX Design', category: 'Design', color: '#0d4a2a' },
  { icon: FlaskConical, label: 'Information Systems', category: 'Professional Skills', color: '#083b22' },
];

const STEPS = [
  {
    num: '01',
    title: 'Register your school',
    body: 'Administrators register their TVET school or university. Each institution gets its own verified space within IMBONI.',
  },
  {
    num: '02',
    title: 'Enroll students & lecturers',
    body: 'Bulk-enroll students and invite lecturers. They choose their tracks, join courses, and set up their profiles.',
  },
  {
    num: '03',
    title: 'Start projects & classes',
    body: 'Lecturers launch courses. Students form teams, create project workspaces, and begin their learning journey.',
  },
];

const PRICING = [
  {
    tier: 'Student',
    price: 'Free',
    period: 'forever',
    desc: 'For individual students finding their way.',
    features: [
      'Access to all 200+ free courses',
      'Join up to 3 project workspaces',
      'IMBONI AI (50 queries/month)',
      'Community forums',
      'Progress certificates',
    ],
    cta: 'Get started free',
    highlight: false,
  },
  {
    tier: 'School',
    price: 'RWF 50,000',
    period: 'every 3 months',
    desc: 'For TVET schools and universities — unlimited free access for every student.',
    features: [
      'Unlimited students and lecturers',
      'Unlimited project workspaces',
      'IMBONI AI (unlimited)',
      'Live class hosting',
      'Admin dashboard and analytics',
      'Priority support',
    ],
    cta: 'Register your school',
    highlight: true,
  },
  {
    tier: 'University',
    price: 'Contact us',
    period: 'custom',
    desc: 'Enterprise setup for higher learning institutions.',
    features: [
      'Everything in School',
      'Multi-department management',
      'LMS integration (Moodle, Canvas)',
      'SLA and uptime guarantee',
      'Dedicated implementation support',
      'Custom AI fine-tuning',
    ],
    cta: 'Talk to us',
    highlight: false,
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function NavBar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-[#D1DDD5]' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#0A5C35] rounded-lg flex items-center justify-center">
            <GraduationCap size={18} className="text-[#E8B800]" />
          </div>
          <div>
            <span className="font-display font-extrabold text-[15px] leading-none text-[#0D1F13]">IMBONI</span>
            <span className="block text-[9px] font-mono tracking-widest text-[#4A6054] uppercase leading-none mt-0.5">Education Hub</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} className="text-sm font-medium text-[#0D1F13]/70 hover:text-[#0A5C35] transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-[#0D1F13]/70 hover:text-[#0A5C35] transition-colors">
            Sign in
          </Link>
          <Link to="/register" className="bg-[#0A5C35] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#083b22] transition-colors">
            Get started free
          </Link>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-[#0D1F13]">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-[#D1DDD5] px-6 py-5 space-y-4">
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="block text-sm font-medium text-[#0D1F13]/80 hover:text-[#0A5C35]">
              {l.label}
            </a>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <Link to="/login" className="text-center text-sm font-medium text-[#0D1F13]/70 py-2">Sign in</Link>
            <Link to="/register" className="text-center bg-[#0A5C35] text-white text-sm font-semibold py-2 rounded-lg">
              Get started free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden" style={{ background: '#0B1F12' }}>
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#E8B800]" />

      <div className="absolute inset-0 flex">
        <div className="w-full md:w-3/5 h-full" style={{ background: '#0B1F12' }} />
        <div className="hidden md:block w-2/5 h-full" style={{ background: 'linear-gradient(135deg, #0d2f1a 0%, #0A5C35 100%)' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-20 grid md:grid-cols-5 gap-12 items-center w-full">
        <div className="md:col-span-3 space-y-8">
          <div className="inline-flex items-center gap-2 bg-[#E8B800]/10 border border-[#E8B800]/30 rounded-full px-4 py-1.5">
            <MapPin size={13} className="text-[#E8B800]" />
            <span className="text-[#E8B800] text-xs font-mono tracking-wide uppercase">Built for Rwanda, for Use by Rwanda</span>
          </div>

          <div className="space-y-4">
            <h1 className="font-display font-black text-white leading-[1.05]" style={{ fontSize: 'clamp(2.6rem, 5.5vw, 4.2rem)' }}>
              Learn. Build. <br />
              <span className="text-[#E8B800]">Collaborate.</span>
              <br />
              Graduate ready.
            </h1>
            <p className="text-[#8FB89E] text-lg max-w-xl leading-relaxed font-body">
              IMBONI Education Hub is an AI-Driven project management, learning and cross-collaboration platform for Rwandan secondary schools and higher learning institutions — completely free.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/register"
              className="group inline-flex items-center justify-center gap-2 bg-[#E8B800] text-[#0D1F13] font-display font-bold text-base px-7 py-3.5 rounded-xl hover:bg-[#f5ca00] transition-colors"
            >
              Start for free
              <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 border border-white/20 text-white font-medium text-base px-7 py-3.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              <Play size={15} fill="white" />
              See how it works
            </a>
          </div>

          <div className="flex flex-wrap gap-6 pt-2">
            {['General-Education Schools', 'TVET Schools', 'Colleges', 'Universities'].map((s) => (
              <span key={s} className="text-[#8FB89E]/60 text-xs font-mono tracking-wide">{s}</span>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 relative">
          <div className="rounded-2xl overflow-hidden border border-white/10 aspect-square bg-white/5">
            <img
              src="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=600&fit=crop&auto=format"
              alt="Students working on capstone project"
              className="w-full h-full object-cover"
            />
          </div>

        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <span className="text-white text-[10px] font-mono tracking-widest uppercase">Scroll</span>
        <ChevronDown size={14} className="text-white animate-bounce" />
      </div>
    </section>
  );
}

function StatsBar() {
  return (
    <section className="bg-[#0A5C35] py-10">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        {STATS.map(({ label, icon: Icon }) => (
          <div key={label} className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Icon size={18} className="text-[#E8B800]" />
            </div>
            <div>
              <p className="font-display font-extrabold text-white text-lg leading-none">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PillarsSection() {
  const [selectedPillar, setSelectedPillar] = useState(null);
  const selectedDetails = selectedPillar ? FEATURE_TABS[selectedPillar.detailKey] : null;

  return (
    <section id="features" className="py-24 bg-[#F4F7F4]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16 grid md:grid-cols-2 gap-8 items-end">
          <div>
            <span className="text-[10px] font-mono tracking-widest uppercase text-[#0A5C35] mb-3 block">Platform pillars</span>
            <h2 className="font-display font-extrabold text-[#0D1F13] leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              Everything a student needs,<br />nothing they don't.
            </h2>
          </div>
          <p className="text-[#4A6054] text-base leading-relaxed font-body">
            IMBONI is not a patchwork of tools. It's a single platform purpose-built for the way Rwandan students study and build — together, under pressure, with deadlines.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {PILLARS.map(({ icon: Icon, title, desc, color, tag, href }) => (
            <article key={title} className={`${color} rounded-2xl p-6 text-white group hover:-translate-y-1 transition-transform duration-200`}>
              <div className="flex items-start justify-between mb-6">
                <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
                  <Icon size={21} className="text-[#E8B800]" />
                </div>
                <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase pt-1">{tag}</span>
              </div>
              <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
              <p className="text-white/65 text-sm leading-relaxed font-body">{desc}</p>
              <button type="button" onClick={() => setSelectedPillar(PILLARS.find(pillar => pillar.title === title))} className="mt-6 flex items-center gap-1.5 text-[#E8B800] text-xs font-semibold hover:text-white transition-colors">
                Learn more <ChevronRight size={13} />
              </button>
            </article>
          ))}
        </div>

        {selectedPillar && selectedDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1F13]/70 p-6" role="presentation" onClick={() => setSelectedPillar(null)}>
            <div role="dialog" aria-modal="true" aria-labelledby="feature-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-7 shadow-2xl" onClick={event => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-[#0A5C35]">{selectedPillar.tag}</p>
                  <h3 id="feature-detail-title" className="font-display text-2xl font-extrabold text-[#0D1F13]">{selectedDetails.headline}</h3>
                </div>
                <button type="button" onClick={() => setSelectedPillar(null)} className="rounded-lg p-2 text-[#4A6054] hover:bg-[#F4F7F4] hover:text-[#0D1F13]" aria-label="Close feature details">
                  <X size={20} />
                </button>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-[#4A6054]">{selectedDetails.body}</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {selectedDetails.items.map(item => <li key={item} className="flex gap-2 text-sm text-[#0D1F13]"><Check size={16} className="mt-0.5 flex-shrink-0 text-[#0A5C35]" />{item}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FeatureTabs() {
  const [active, setActive] = useState('projects');
  const data = FEATURE_TABS[active];

  const TABS = [
    { key: 'projects', label: 'Projects', icon: Layers },
    { key: 'learning', label: 'Learning', icon: BookOpen },
    { key: 'teams', label: 'Teams', icon: Users },
    { key: 'ai', label: 'AI Tutor', icon: Brain },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-[10px] font-mono tracking-widest uppercase text-[#0A5C35] mb-3 block">Deep dive</span>
          <h2 className="font-display font-extrabold text-[#0D1F13] leading-tight" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)' }}>
            Built for every moment of your academic life
          </h2>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-14">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                active === key ? 'bg-[#0A5C35] text-white shadow-md' : 'bg-[#F4F7F4] text-[#4A6054] hover:bg-[#E2EBE5]'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 order-2 md:order-1">
            <h3 className="font-display font-bold text-[#0D1F13] leading-tight text-2xl">{data.headline}</h3>
            <p className="text-[#4A6054] leading-relaxed font-body">{data.body}</p>
            <ul className="space-y-3">
              {data.items.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#0A5C35]/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <Check size={11} className="text-[#0A5C35]" strokeWidth={3} />
                  </div>
                  <span className="text-[#0D1F13] text-sm font-body">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 md:order-2 rounded-2xl overflow-hidden border border-[#D1DDD5] aspect-[4/3] bg-[#E2EBE5]">
            <img src={data.image} alt={data.imageAlt} className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </section>
  );
}

function TracksSection() {
  return (
    <section id="learning" className="py-24 bg-[#0B1F12]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-10 items-end mb-16">
          <div>
            <span className="text-[10px] font-mono tracking-widest uppercase text-[#E8B800] mb-3 block">Learning tracks</span>
            <h2 className="font-display font-extrabold text-white leading-tight" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)' }}>
              Various courses aligned to Rwanda's IT curriculum
            </h2>
          </div>
          <p className="text-[#8FB89E] leading-relaxed font-body">
            Every track is mapped to TVET Rwanda's syllabi and REB standards. Whether you're at secondary school or in your final university year, IMBONI has the course you need — and it's free.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {TRACKS.map(({ icon: Icon, label, category, color }) => (
            <Link key={label} to={`/free-courses?category=${encodeURIComponent(category)}`} className="group bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${color}40` }}>
                <Icon size={18} className="text-[#E8B800]" />
              </div>
              <h4 className="font-display font-semibold text-white text-sm leading-snug mb-1">{label}</h4>
            </Link>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Link to="/free-courses" className="inline-flex items-center gap-2 bg-[#E8B800] text-[#0D1F13] font-display font-bold text-sm px-6 py-3 rounded-xl hover:bg-[#f5ca00] transition-colors">
            Browse all courses <ArrowRight size={15} />
          </Link>
          <span className="text-[#8FB89E]/60 text-xs font-mono">All courses are free </span>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="py-24 bg-[#F4F7F4]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-[10px] font-mono tracking-widest uppercase text-[#0A5C35] mb-3 block">Getting started</span>
          <h2 className="font-display font-extrabold text-[#0D1F13] leading-tight" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)' }}>
            Up and running in under a day
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-px bg-[#D1DDD5]" />
          {STEPS.map(({ num, title, body }) => (
            <div key={num} className="relative">
              <div className="w-16 h-16 rounded-2xl bg-[#0A5C35] flex items-center justify-center mb-6 relative z-10">
                <span className="font-display font-extrabold text-[#E8B800] text-xl">{num}</span>
              </div>
              <h3 className="font-display font-bold text-[#0D1F13] text-lg mb-2">{title}</h3>
              <p className="text-[#4A6054] text-sm leading-relaxed font-body">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SchoolsSection() {
  return (
    <section id="schools" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        <div className="space-y-6">
          <span className="text-[10px] font-mono tracking-widest uppercase text-[#0A5C35] block">For institutions</span>
          <h2 className="font-display font-extrabold text-[#0D1F13] leading-tight" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)' }}>
            One platform for your entire institution
          </h2>
          <p className="text-[#4A6054] leading-relaxed font-body">
            IMBONI gives administrators full visibility into student progress, collaborative projects, and academic performance across every department — without the complexity of enterprise software.
          </p>

          <div className="space-y-4">
            {[
              { icon: BarChart3, title: 'Admin dashboard', desc: 'Real-time analytics on student engagement, project completion rates, and course progress.' },
              { icon: Shield, title: 'Safe and private', desc: "Student data stays in Rwanda. Compliant with national data protection requirements." },
              { icon: Wifi, title: 'Works on any connection', desc: "Optimized for Rwanda's networks. Core features work even on slow or intermittent connections." },
              { icon: Building2, title: 'Cross-school collaboration', desc: 'Partner with other institutions on joint projects and shared curriculum delivery.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 p-4 rounded-xl border border-[#E2EBE5] hover:border-[#0A5C35]/30 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-[#0A5C35]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={17} className="text-[#0A5C35]" />
                </div>
                <div>
                  <h4 className="font-display font-semibold text-[#0D1F13] text-sm mb-0.5">{title}</h4>
                  <p className="text-[#4A6054] text-xs leading-relaxed font-body">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Link to="/login" className="inline-flex items-center gap-2 bg-[#0A5C35] text-white font-display font-bold text-sm px-6 py-3 rounded-xl hover:bg-[#083b22] transition-colors">
            Register your school <ArrowRight size={15} />
          </Link>
        </div>

        <div className="relative">
          <div className="rounded-2xl overflow-hidden border border-[#D1DDD5] aspect-square bg-[#E2EBE5]">
            <img
              src="https://images.unsplash.com/photo-1509062522246-3755977927d7?w=700&h=700&fit=crop&auto=format"
              alt="Students in a Rwandan classroom working on computers"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-[10px] font-mono tracking-widest uppercase text-[#0A5C35] mb-3 block">Pricing</span>
          <h2 className="font-display font-extrabold text-[#0D1F13] leading-tight" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)' }}>
            Free for students. Simple for schools.
          </h2>
          <p className="text-[#4A6054] mt-4 max-w-xl mx-auto font-body">
            A school subscribes once every three months, and every one of its students uses the platform at no extra cost.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PRICING.map(({ tier, price, period, desc, features, cta, highlight }) => (
            <div key={tier} className={`rounded-2xl p-7 flex flex-col gap-6 ${highlight ? 'bg-[#0A5C35] text-white' : 'bg-[#F4F7F4] border border-[#E2EBE5]'}`}>
              {highlight && (
                <div className="inline-block self-start bg-[#E8B800] text-[#0D1F13] text-[10px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                  Recommended
                </div>
              )}
              <div>
                <p className={`font-mono text-xs tracking-widest uppercase mb-2 ${highlight ? 'text-white/50' : 'text-[#4A6054]'}`}>{tier}</p>
                <p className={`font-display font-extrabold text-4xl leading-none ${highlight ? 'text-white' : 'text-[#0D1F13]'}`}>{price}</p>
                <p className={`text-xs mt-1 font-mono ${highlight ? 'text-white/50' : 'text-[#4A6054]'}`}>{period}</p>
              </div>
              <p className={`text-sm font-body ${highlight ? 'text-white/70' : 'text-[#4A6054]'}`}>{desc}</p>
              <ul className="space-y-2.5 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check size={14} className={`flex-shrink-0 mt-0.5 ${highlight ? 'text-[#E8B800]' : 'text-[#0A5C35]'}`} strokeWidth={3} />
                    <span className={`font-body ${highlight ? 'text-white/80' : 'text-[#0D1F13]'}`}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={tier === 'Student' ? '/register' : '/login'}
                className={`block text-center font-display font-bold text-sm px-5 py-3 rounded-xl transition-colors ${
                  highlight ? 'bg-[#E8B800] text-[#0D1F13] hover:bg-[#f5ca00]' : 'bg-[#0A5C35] text-white hover:bg-[#083b22]'
                }`}
              >
                {cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-24 bg-[#0B1F12] relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#E8B800]" />
      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center space-y-7">
        <span className="text-[10px] font-mono tracking-widest uppercase text-[#E8B800] block">Join the movement</span>
        <h2 className="font-display font-extrabold text-white leading-tight" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.2rem)' }}>
          Rwanda's students deserve a platform built for them.
        </h2>
        <p className="text-[#8FB89E] leading-relaxed font-body max-w-xl mx-auto">
          Join thousands of students and lecturers already using IMBONI to study smarter, build real projects, and collaborate across Rwanda's best institutions.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/register" className="inline-flex items-center justify-center gap-2 bg-[#E8B800] text-[#0D1F13] font-display font-bold text-base px-8 py-4 rounded-xl hover:bg-[#f5ca00] transition-colors">
            Get started free <ArrowRight size={17} />
          </Link>
          <Link to="/login" className="inline-flex items-center justify-center gap-2 border border-white/20 text-white font-medium text-base px-8 py-4 rounded-xl hover:bg-white/5 transition-colors">
            Register your school
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    { label: 'Platform', links: ['Project Management', 'Learning Management', 'Team Spaces', 'IMBONI AI', 'Analytics'] },
    { label: 'For Schools', links: ['TVET Schools', 'Universities', 'Admin Dashboard', 'Bulk Enrollment', 'Support'] },
    { label: 'Learn', links: ['Course Catalog', 'Software Dev', 'Networking', 'Web Development', 'Certifications'] },
    { label: 'Company', links: ['About', 'Blog', 'Careers', 'Privacy Policy', 'Terms of Use'] },
  ];

  return (
    <footer className="bg-[#0B1F12] border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-14">
          <div className="col-span-2 md:col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#0A5C35] rounded-lg flex items-center justify-center">
                <GraduationCap size={18} className="text-[#E8B800]" />
              </div>
              <div>
                <span className="font-display font-extrabold text-[15px] leading-none text-white">IMBONI</span>
                <span className="block text-[9px] font-mono tracking-widest text-[#8FB89E]/50 uppercase leading-none mt-0.5">Education Hub</span>
              </div>
            </div>
            <p className="text-[#8FB89E]/60 text-xs leading-relaxed font-body">
              A learning and project management platform for Rwandan TVET Schools & Higher Learning Institutions.
            </p>
            <div className="flex items-center gap-1 text-[#8FB89E]/40">
              <MapPin size={11} />
              <span className="text-[10px] font-mono">Kigali, Rwanda</span>
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.label}>
              <p className="text-white/80 font-display font-semibold text-sm mb-4">{col.label}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}><a href="#" className="text-[#8FB89E]/60 text-xs hover:text-[#8FB89E] transition-colors font-body">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[#8FB89E]/40 text-xs font-mono">© 2026 IMBONI Education Hub. All rights reserved.</p>
          <p className="text-[#8FB89E]/40 text-xs font-mono">Made with pride in 🇷🇼 Rwanda</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <HeroSection />
      <StatsBar />
      <PillarsSection />
      <FeatureTabs />
      <TracksSection />
      <HowItWorks />
      <SchoolsSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}
