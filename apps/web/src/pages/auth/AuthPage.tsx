import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { AppError } from '../../core/db/core';
import { useAuth } from '../../app/auth';
import { useApp } from '../../app/context';
import { hasAccounts } from '../../platform/auth';
import { cn } from '../../components/ui/cn';
import { Mark } from '../../ui/Brand';
import { ThemeButton } from '../../ui/Shell';

const field = 'noir-input w-full h-12 px-4 rounded-2xl text-[15px] text-content placeholder:text-content-subtle focus:outline-none';

function Input({ label, type = 'text', value, onChange, autoComplete, hint, autoFocus, trailing, dir }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; autoComplete?: string; hint?: string; autoFocus?: boolean; trailing?: ReactNode; dir?: 'ltr';
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[14px] font-medium text-content-muted">{label}</span>
      <span className="relative">
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} autoFocus={autoFocus} dir={dir}
          className={cn(field, trailing ? 'pe-12' : undefined)} required={type !== 'tel'} />
        {trailing && <span className="absolute end-1.5 top-1/2 -translate-y-1/2">{trailing}</span>}
      </span>
      {hint && <span className="text-[13px] text-content-subtle">{hint}</span>}
    </label>
  );
}

export default function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const { t, lang, setLang } = useApp();
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [firstRun, setFirstRun] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    hasAccounts().then((any) => {
      setFirstRun(!any);
      if (!any && mode === 'signin') navigate('/signup', { replace: true });
    });
  }, [mode, navigate]);
  useEffect(() => setError(''), [mode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        if (f.password !== f.confirm) throw new AppError('web.auth.errors.mismatch');
        await signUp({ name: f.name, email: f.email, phone: f.phone, password: f.password });
      } else {
        await signIn(f.email, f.password, remember);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof AppError ? t(err.key) : t('errors.unknown'));
    } finally {
      setBusy(false);
    }
  };

  const eye = (
    <button type="button" onClick={() => setShow(!show)} aria-label={show ? t('web.auth.hide') : t('web.auth.show')}
      className="w-9 h-9 rounded-full grid place-items-center text-content-subtle hover:text-content hover:bg-surface-2 transition-colors">
      {show ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
  const signup = mode === 'signup';

  return (
    <div className="relative min-h-viewport overflow-hidden bg-brand grid place-items-center px-4 py-10">
      {/* The background: the brand violet with a faint dot grid and two soft rings, nothing that competes with the card. */}
      <div aria-hidden className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgb(255_255_255/0.55)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
      <div aria-hidden className="absolute -top-40 -start-40 w-[520px] h-[520px] rounded-full bg-white/[0.07]" />
      <div aria-hidden className="absolute -bottom-52 -end-32 w-[640px] h-[640px] rounded-full bg-white/[0.06]" />
      <div aria-hidden className="absolute bottom-24 end-40 w-[220px] h-[220px] rounded-full border border-white/15" />

      <div className="absolute top-5 end-5 flex items-center gap-1 text-white">
        <button type="button" onClick={() => setLang(lang === 'en' ? 'ur' : 'en')}
          className="h-10 px-3.5 rounded-full text-[14px] font-medium text-white/85 hover:text-white hover:bg-white/15 transition-colors">{lang === 'en' ? 'اردو' : 'English'}</button>
        <span className="[&_button]:text-white/85 [&_button:hover]:text-white [&_button:hover]:bg-white/15"><ThemeButton /></span>
      </div>

      <div className="relative w-full max-w-[420px]">
        <div className="flex items-center justify-center gap-3 mb-6 text-white">
          <span className="w-11 h-11 rounded-[14px] bg-white grid place-items-center shadow-[0_10px_30px_-12px_rgba(0,0,0,0.4)]"><Mark size={34} /></span>
          <span className="font-display text-[22px] tracking-[-0.02em]">Truck Khata</span>
        </div>

        <form onSubmit={submit} noValidate className="card !rounded-[28px] px-7 sm:px-9 py-8 flex flex-col gap-4 shadow-[0_40px_80px_-30px_rgba(17,19,24,0.55)]">
          <div className="text-center mb-1">
            <h1 className="font-display text-[26px] leading-tight tracking-[-0.02em]">{t(signup ? 'web.auth.signUpTitle' : 'web.auth.signInTitle')}</h1>
            <p className="mt-1 text-[14.5px] text-content-muted">{t(signup ? 'web.auth.signUpSub' : 'web.auth.signInSub')}</p>
          </div>
          {signup && firstRun && <p className="rounded-2xl bg-brand-soft px-4 py-3 text-[13.5px] text-content">{t('web.auth.firstSetup')}</p>}
          {error && <p role="alert" className="rounded-2xl bg-bad/10 text-bad px-4 py-3 text-[13.5px] font-medium">{error}</p>}
          {signup && <Input label={t('web.auth.name')} value={f.name} onChange={set('name')} autoComplete="name" autoFocus />}
          <Input label={t('web.auth.email')} type="email" dir="ltr" value={f.email} onChange={set('email')} autoComplete="email" autoFocus={!signup} />
          {signup && <Input label={t('web.auth.phone')} type="tel" dir="ltr" value={f.phone} onChange={set('phone')} autoComplete="tel" />}
          <Input label={t('web.auth.password')} type={show ? 'text' : 'password'} dir="ltr" value={f.password} onChange={set('password')}
            autoComplete={signup ? 'new-password' : 'current-password'} hint={signup ? t('web.auth.passwordHint') : undefined} trailing={eye} />
          {signup && <Input label={t('web.auth.confirm')} type={show ? 'text' : 'password'} dir="ltr" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" />}
          {!signup && (
            <label className="flex items-center gap-2.5 text-[14px] text-content-muted select-none cursor-pointer">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 accent-[rgb(var(--brand))]" />
              {t('web.auth.remember')}
            </label>
          )}
          <button type="submit" disabled={busy} className="noir-cta h-12 mt-1 rounded-full inline-flex items-center justify-center gap-2 text-[15px] font-medium disabled:opacity-60">
            {busy && <Loader2 size={17} className="animate-spin" />}{t(signup ? 'web.auth.signUp' : 'web.auth.signIn')}
          </button>
          <p className="text-center text-[14px] text-content-muted">
            {t(signup ? 'web.auth.haveAccount' : 'web.auth.noAccount')}{' '}
            <Link to={signup ? '/login' : '/signup'} className="font-medium text-brand-strong hover:underline underline-offset-4">{t(signup ? 'web.auth.toSignIn' : 'web.auth.toSignUp')}</Link>
          </p>
        </form>

        <p className="mt-5 text-center text-[13px] text-white/75">{t('web.auth.localNote')}</p>
      </div>
    </div>
  );
}
