import { useEffect, type CSSProperties, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, BookOpenText, Download, FileSpreadsheet, HardDrive, History, KeyRound, Plus, Printer, Quote, Receipt, Route,
  Search, ShieldCheck, Trash2, TrendingUp, Users,
} from 'lucide-react';
import { useApp } from '../app/context';
import { useAuth } from '../app/auth';
import type { Lang } from '../core/i18n';
import { cn } from '../components/ui/cn';
import { Mark } from '../ui/Brand';

/** Where "Book a demo" sends people. Replace with the real address before launch. */
const DEMO_EMAIL = 'demo@example.com';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Icon = ComponentType<any>;

const sections = ['features', 'how', 'languages', 'data', 'faq'] as const;
const features: [string, Icon][] = [
  ['ada', BookOpenText], ['sheet', Route], ['broker', Users], ['bills', Receipt], ['insurance', ShieldCheck], ['report', BarChart3],
];
const extras: [string, Icon][] = [
  ['search', Search], ['print', Printer], ['excel', FileSpreadsheet], ['history', History], ['bin', Trash2], ['backup', Download],
];
const dataPoints: [string, Icon][] = [['where', HardDrive], ['accounts', KeyRound], ['backup', Download]];
const stats = ['modules', 'reports', 'languages', 'servers'] as const;
const howSteps = ['account', 'entry', 'month'] as const;
const faqs = ['internet', 'computers', 'urdu', 'mistake', 'print', 'profit'] as const;

const title = 'lp-h text-[32px] sm:text-[44px] lg:text-[52px]';
const lead = 'text-[17px] sm:text-[18px] leading-[1.65] text-content-muted';

/** Stagger: each item in a row starts a beat after the one before it. */
const delay = (i: number) => ({ '--d': `${i * 80}ms` } as CSSProperties);

/** A heading that un-blurs word by word when it comes on screen. */
function Words({ text }: { text: string }) {
  return <>{text.split(' ').map((w, i) => <span key={i} className="lp-word" style={{ '--d': `${i * 55}ms` } as CSSProperties}>{`${w} `}</span>)}</>;
}

/** A real screen of the app, captured from the sample khata in the given language. */
function Shot({ name, lang, eager }: { name: string; lang: Lang; eager?: boolean }) {
  const { t } = useApp();
  return (
    <div className="lp-shot">
      <img src={`/landing/${lang}/${name}.jpg`} width={1920} height={1200} loading={eager ? 'eager' : 'lazy'} decoding="async"
        alt={`${t('web.landing.shotAlt')}: ${name}`} />
    </div>
  );
}

/**
 * The public product page: what Truck Khata does for a transport owner, shown on real
 * screens of the app. Dark, deep green, in Urdu or English.
 */
export default function Landing() {
  const { t, lang, setLang } = useApp();
  const { user } = useAuth();
  const L = (key: string) => t(`web.landing.${key}`);
  const start = user ? '/' : '/signup';
  const startLabel = user ? L('openKhata') : L('start');
  const demo = `mailto:${DEMO_EMAIL}?subject=${encodeURIComponent(L('demoSubject'))}`;
  const other = lang === 'en' ? 'اردو' : 'English';
  const switchLang = () => void setLang(lang === 'en' ? 'ur' : 'en');

  // Keep the page dark past its edges (overscroll), then hand the app its desk back.
  useEffect(() => {
    const body = document.body.style.background;
    document.body.style.background = '#0A0B0C';
    return () => { document.body.style.background = body; };
  }, []);

  // Sections rise in once as they enter the screen.
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.lp-reveal:not(.is-in), .lp-words:not(.is-in)').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp relative min-h-viewport overflow-x-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:start-3 focus:px-4 focus:py-2 focus:rounded-[10px] focus:bg-white focus:text-black">{L('skip')}</a>
      <div aria-hidden className="lp-aurora" />
      <div aria-hidden className="lp-grid" />

      <header className="sticky top-0 z-40 border-b border-[var(--lp-hair)] bg-[rgb(10_11_12/0.76)] backdrop-blur-xl">
        <div className="lp-wrap h-16 flex items-center gap-10">
          <Link to={user ? '/' : '/welcome'} className="flex items-center gap-2.5 shrink-0">
            <Mark size={30} />
            <span className="lp-h text-[18px] !tracking-[-0.02em]">Truck Khata</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-7">
            {sections.map((id) => (
              <a key={id} href={`#${id}`} className="text-[14px] text-content-muted hover:text-content transition-colors">{L(`nav.${id}`)}</a>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <button type="button" onClick={switchLang} className="h-9 px-3 rounded-[8px] text-[14px] text-content-muted hover:text-content hover:bg-white/5 transition-colors">{other}</button>
            {!user && <Link to="/login" className="hidden sm:inline-flex items-center h-9 px-3 rounded-[8px] text-[14px] text-content-muted hover:text-content hover:bg-white/5 transition-colors">{L('signIn')}</Link>}
            <Link to={start} className="lp-btn lp-btn-sm lp-btn-primary">{startLabel}</Link>
          </div>
        </div>
      </header>

      <main id="main" className="relative">
        {/* Hero: fits one screen. The promise on one side, the real dashboard on the other. */}
        <section className="lp-wrap lg:min-h-[calc(100vh/var(--ui-zoom)_-_65px)] py-16 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-x-14 gap-y-14 items-center">
          <div className="lg:col-span-5">
            <h1 className="lp-h lp-words is-in text-[40px] sm:text-[54px] xl:text-[66px]"><Words text={L('hero.title')} /></h1>
            <p className={cn(lead, 'lp-reveal is-in mt-7 max-w-[34rem] sm:text-[19px]')} style={delay(4)}>{L('hero.sub')}</p>
            <div className="lp-reveal is-in mt-9 flex flex-wrap items-center gap-3" style={delay(6)}>
              <Link to={start} className="lp-btn lp-btn-primary">{startLabel}</Link>
              <a href={demo} className="lp-btn lp-btn-ghost">{L('demo')}</a>
            </div>
            <p className="mt-6 max-w-[30rem] text-[14px] leading-[1.6] text-content-subtle">{L('hero.note')}</p>
          </div>
          <div className="lg:col-span-7 min-w-0 relative lg:py-10">
            <div className="lp-frame lp-hero-in"><Shot name="dashboard" lang={lang} eager /></div>
            <HeroCard className="hidden lg:block absolute -end-5 top-0 w-[250px]" Icon={TrendingUp} k="profit" order={0} />
            <HeroCard className="hidden lg:block absolute -start-8 bottom-[16%] w-[250px]" Icon={Users} k="owed" order={1} />
            <HeroCard className="hidden lg:block absolute end-[10%] bottom-0 w-[250px]" Icon={ShieldCheck} k="alerts" order={2} />
          </div>
        </section>

        {/* Facts */}
        <section className="lp-wrap mt-8 lg:mt-4">
          <dl className="lp-card lp-reveal grid grid-cols-2 lg:grid-cols-4 overflow-hidden">
            {stats.map((k, i) => (
              <div key={k} className={cn('lp-stat px-6 py-7 sm:px-8 sm:py-9', i > 0 && 'lg:border-s border-[var(--lp-hair)]', i % 2 === 1 && 'border-s lg:border-s', i > 1 && 'border-t lg:border-t-0')}>
                <dd dir="ltr" className="lp-h text-[40px] sm:text-[52px] tabular-nums text-start">{L(`stats.${k}.value`)}</dd>
                <dt className="mt-2 text-[14px] leading-[1.5] text-content-muted">{L(`stats.${k}.label`)}</dt>
              </div>
            ))}
          </dl>
        </section>

        {/* Features: one card per module */}
        <section id="features" className="lp-section scroll-mt-16">
          <div className="lp-wrap">
            <div className="max-w-[820px]">
              <h2 className={cn(title, 'lp-words')}><Words text={L('features.title')} /></h2>
              <p className={cn(lead, 'lp-reveal mt-6 max-w-[640px]')}>{L('features.sub')}</p>
            </div>
            <div className="mt-12 lg:mt-16 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {features.map(([key, Icon], i) => (
                <article key={key} className="lp-card lp-hover lp-feature lp-reveal relative overflow-hidden p-7 sm:p-8" style={delay(i)}>
                  <Icon aria-hidden className="lp-feature-icon" strokeWidth={1.1} />
                  <h3 className="lp-h relative text-[22px] sm:text-[24px] !leading-[1.25]">{L(`features.items.${key}.name`)}</h3>
                  <p className="relative mt-2.5 pe-24 text-[15px] leading-[1.6] text-content-muted">{L(`features.items.${key}.line`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* The rest of the toolkit */}
        <section className="lp-wrap pb-24 lg:pb-36">
          <h2 className={cn(title, 'lp-words max-w-[720px]')}><Words text={L('more.title')} /></h2>
          <dl className="mt-12 lg:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {extras.map(([key, Icon], i) => (
              <div key={key} className="lp-card lp-hover lp-reveal p-7" style={delay(i)}>
                <span className="lp-chip"><Icon size={18} strokeWidth={1.7} /></span>
                <dt className="mt-6 text-[17px] font-semibold">{L(`more.items.${key}.title`)}</dt>
                <dd className="mt-2 text-[15px] leading-[1.65] text-content-muted">{L(`more.items.${key}.text`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* How it works */}
        <section id="how" className="lp-section border-t border-[var(--lp-hair)] scroll-mt-16">
          <div className="lp-wrap">
            <h2 className={cn(title, 'lp-words')}><Words text={L('how.title')} /></h2>
            <ol className="mt-14 lg:mt-20 grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-12">
              {howSteps.map((k, i) => (
                <li key={k} className="lp-reveal" style={delay(i)}>
                  <div className="flex items-center gap-4">
                    <span dir="ltr" className="lp-h grid place-items-center w-11 h-11 rounded-full text-[17px] text-[var(--lp-green-hi)] bg-[rgb(193_241_29/0.10)] shadow-[inset_0_0_0_1px_rgb(193_241_29/0.28)]">{i + 1}</span>
                    <span className="h-px flex-1 bg-[var(--lp-hair-2)]" />
                  </div>
                  <h3 className="lp-h mt-7 text-[22px] sm:text-[24px]">{L(`how.steps.${k}.title`)}</h3>
                  <p className="mt-3 max-w-[22rem] text-[15px] leading-[1.7] text-content-muted">{L(`how.steps.${k}.text`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Languages */}
        <section id="languages" className="lp-section border-t border-[var(--lp-hair)] scroll-mt-16 overflow-hidden">
          <div className="lp-wrap grid grid-cols-1 lg:grid-cols-12 gap-x-16 gap-y-14 items-center">
            <div className="lp-reveal lg:col-span-5">
              <h2 className={cn(title, 'lp-words')}><Words text={L('languages.title')} /></h2>
              <p className={cn(lead, 'mt-6')}>{L('languages.sub')}</p>
              <button type="button" onClick={switchLang} className="lp-btn lp-btn-ghost mt-8">{L('languages.button')}</button>
            </div>
            <div className="lp-reveal lg:col-span-7 min-w-0 relative pb-[30%]">
              <div className="lp-frame w-[80%]"><Shot name="trips" lang="en" /></div>
              <div className="absolute bottom-0 end-0 w-[80%]"><div className="lp-frame"><Shot name="trips" lang="ur" /></div></div>
            </div>
          </div>
        </section>

        {/* Security and data */}
        <section id="data" className="lp-section border-t border-[var(--lp-hair)] scroll-mt-16">
          <div className="lp-wrap">
            <div className="lp-reveal max-w-[720px]">
              <h2 className={cn(title, 'lp-words')}><Words text={L('data.title')} /></h2>
              <p className={cn(lead, 'mt-6 max-w-[600px]')}>{L('data.sub')}</p>
            </div>
            <dl className="mt-12 lg:mt-16 grid grid-cols-1 lg:grid-cols-3 gap-4">
              {dataPoints.map(([key, Icon], i) => (
                <div key={key} className="lp-card lp-hover lp-reveal p-7 sm:p-8" style={delay(i)}>
                  <span className="lp-chip"><Icon size={18} strokeWidth={1.7} /></span>
                  <dt className="mt-6 text-[18px] font-semibold">{L(`data.points.${key}.title`)}</dt>
                  <dd className="mt-3 text-[15px] leading-[1.7] text-content-muted">{L(`data.points.${key}.text`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Testimonials: placeholders until real quotes are supplied */}
        <section className="lp-section border-t border-[var(--lp-hair)]">
          <div className="lp-wrap">
            <h2 className={cn(title, 'lp-words')}><Words text={L('testimonials.title')} /></h2>
            <div className="mt-12 lg:mt-16 grid grid-cols-1 lg:grid-cols-3 gap-4">
              {(['a', 'b', 'c'] as const).map((k, i) => (
                <figure key={k} className="lp-card lp-hover lp-reveal p-7 sm:p-8 flex flex-col" style={delay(i)}>
                  <div className="flex items-center justify-between gap-3">
                    <Quote size={22} strokeWidth={1.6} className="text-[var(--lp-green-hi)] rtl:-scale-x-100" />
                    <span className="inline-flex items-center h-6 px-2 rounded-md text-[12px] font-medium text-amber-200 bg-amber-400/10 ring-1 ring-amber-300/25">{L('testimonials.placeholder')}</span>
                  </div>
                  <blockquote className="mt-6 text-[17px] leading-[1.65] text-content">{L(`testimonials.items.${k}.quote`)}</blockquote>
                  <figcaption className="mt-auto pt-8 flex items-center gap-3">
                    <span aria-hidden className="w-10 h-10 rounded-full bg-white/5 ring-1 ring-[var(--lp-hair-2)]" />
                    <span>
                      <span className="block text-[15px] font-medium">{L(`testimonials.items.${k}.name`)}</span>
                      <span className="block text-[13px] text-content-subtle">{L(`testimonials.items.${k}.role`)}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="lp-section border-t border-[var(--lp-hair)] scroll-mt-16">
          <div className="lp-wrap grid grid-cols-1 lg:grid-cols-12 gap-x-16 gap-y-10">
            <h2 className={cn(title, 'lp-words lg:col-span-5')}><Words text={L('faq.title')} /></h2>
            <div className="lp-faq lp-reveal lg:col-span-7">
              {faqs.map((key) => (
                <details key={key} className="border-b border-[var(--lp-hair-2)] first:border-t">
                  <summary className="flex items-center justify-between gap-6 py-6 text-[17px] font-medium hover:text-[var(--lp-green-hi)] transition-colors">
                    {L(`faq.items.${key}.q`)}
                    <Plus size={18} strokeWidth={1.8} className="lp-plus shrink-0 text-content-subtle" />
                  </summary>
                  <p className="pb-7 -mt-1 max-w-[40rem] text-[15px] leading-[1.75] text-content-muted">{L(`faq.items.${key}.a`)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="lp-wrap pb-24 lg:pb-32">
          <div className="lp-card lp-reveal relative overflow-hidden px-6 py-16 sm:px-12 sm:py-24 text-center">
            <div aria-hidden className="absolute inset-0 pointer-events-none [background:radial-gradient(60%_90%_at_50%_115%,rgb(193_241_29/0.20),transparent_70%)]" />
            <div className="relative">
              <h2 className="lp-h lp-words mx-auto max-w-[760px] text-[34px] sm:text-[52px]"><Words text={L('final.title')} /></h2>
              <p className={cn(lead, 'mx-auto mt-6 max-w-[560px]')}>{L('final.sub')}</p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link to={start} className="lp-btn lp-btn-primary">{startLabel}</Link>
                <a href={demo} className="lp-btn lp-btn-ghost">{L('demo')}</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-[var(--lp-hair)]">
        <div className="lp-wrap py-14 grid grid-cols-2 lg:grid-cols-12 gap-x-10 gap-y-10">
          <div className="col-span-2 lg:col-span-6">
            <span className="flex items-center gap-2.5">
              <Mark size={28} />
              <span className="lp-h text-[17px] !tracking-[-0.02em]">Truck Khata</span>
            </span>
            <p className="mt-4 max-w-[26rem] text-[14px] leading-[1.7] text-content-muted">{L('footer.line')}</p>
          </div>
          <nav className="lg:col-span-3 flex flex-col gap-3">
            <span className="text-[14px] font-semibold">{L('footer.product')}</span>
            {sections.map((id) => <a key={id} href={`#${id}`} className="text-[14px] text-content-muted hover:text-content transition-colors">{L(`nav.${id}`)}</a>)}
          </nav>
          <nav className="lg:col-span-3 flex flex-col gap-3">
            <span className="text-[14px] font-semibold">{L('footer.account')}</span>
            {user
              ? <Link to="/" className="text-[14px] text-content-muted hover:text-content transition-colors">{L('openKhata')}</Link>
              : <>
                <Link to="/signup" className="text-[14px] text-content-muted hover:text-content transition-colors">{L('start')}</Link>
                <Link to="/login" className="text-[14px] text-content-muted hover:text-content transition-colors">{L('signIn')}</Link>
              </>}
            <a href={demo} className="text-[14px] text-content-muted hover:text-content transition-colors">{L('demo')}</a>
            <button type="button" onClick={switchLang} className="text-start text-[14px] text-content-muted hover:text-content transition-colors">{other}</button>
          </nav>
        </div>
        <div className="border-t border-[var(--lp-hair)]">
          <p className="lp-wrap py-6 text-[13px] text-content-subtle">{L('footer.note')}</p>
        </div>
      </footer>
    </div>
  );
}

/** One highlighted figure from the product, floating over the hero screenshot. */
function HeroCard({ k, Icon, className, order }: { k: 'profit' | 'owed' | 'alerts'; Icon: Icon; className?: string; order: number }) {
  const { t } = useApp();
  const L = (key: string) => t(`web.landing.hero.cards.${k}.${key}`);
  return (
    <div className={cn('lp-float lp-pop p-4', className)} style={{ '--d': `${700 + order * 160}ms`, '--f': `${order * -1.6}s` } as CSSProperties}>
      <div className="flex items-center gap-3">
        <span className="lp-chip"><Icon size={17} strokeWidth={1.8} /></span>
        <span className="min-w-0">
          <span className="block text-[14px] font-medium truncate">{L('label')}</span>
          <span className="block text-[12px] text-content-subtle truncate">{L('sub')}</span>
        </span>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span dir="ltr" className={cn('lp-h text-[24px] tabular-nums', k === 'owed' ? 'text-[#FF8A80]' : k === 'profit' ? 'text-[var(--lp-green-hi)]' : 'text-content')}>{L('value')}</span>
        {k === 'profit' && <span className="inline-flex items-center h-5 px-1.5 rounded-[5px] text-[11px] font-medium text-[#111214] bg-[#C1F11D]">{L('badge')}</span>}
      </div>
    </div>
  );
}
