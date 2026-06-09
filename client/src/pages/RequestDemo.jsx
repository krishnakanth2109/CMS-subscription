import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  BrainCircuit,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const initialForm = {
  fullName: '',
  workEmail: '',
  phoneNumber: '',
  companyName: '',
  companySize: '',
  designation: '',
  preferredDemoTime: '',
  message: '',
};

const featurePoints = [
  { label: 'Candidate & recruiter management', Icon: Users },
  { label: 'Job requirement and client tracking', Icon: BriefcaseBusiness },
  { label: 'AI-based candidate-job match score', Icon: BrainCircuit },
  { label: 'Interview pipeline and report analytics', Icon: BarChart3 },
  { label: '30-minute personalized walkthrough', Icon: Clock3 },
  { label: 'No credit card required', Icon: ShieldCheck },
];

const allowedCompanySizes = ['1-10', '11-50', '51-200', '201-500', '500+'];

function formatLocalDatetimeValue(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizePhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91${digits.slice(2)}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  return '';
}

function validateForm(form) {
  const nextErrors = {};
  const fullName = normalizeText(form.fullName);
  const workEmail = normalizeText(form.workEmail).toLowerCase();
  const phoneNumber = normalizePhoneNumber(form.phoneNumber);
  const companyName = normalizeText(form.companyName);
  const companySize = normalizeText(form.companySize);
  const designation = normalizeText(form.designation);
  const message = normalizeText(form.message);

  if (!fullName) {
    nextErrors.fullName = 'Required';
  } else if (fullName.length < 2 || !/[A-Za-z]/.test(fullName) || /^\d+$/.test(fullName)) {
    nextErrors.fullName = 'Enter a valid full name';
  }

  if (!workEmail) {
    nextErrors.workEmail = 'Required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
    nextErrors.workEmail = 'Enter a valid email';
  }

  if (!normalizeText(form.phoneNumber)) {
    nextErrors.phoneNumber = 'Required';
  } else if (!phoneNumber) {
    nextErrors.phoneNumber = 'Enter a valid Indian mobile number';
  }

  if (!companyName) {
    nextErrors.companyName = 'Required';
  } else if (companyName.length < 2) {
    nextErrors.companyName = 'Enter a valid company name';
  }

  if (!companySize) {
    nextErrors.companySize = 'Required';
  } else if (!allowedCompanySizes.includes(companySize)) {
    nextErrors.companySize = 'Select a valid company size';
  }

  if (!normalizeText(form.preferredDemoTime)) {
    nextErrors.preferredDemoTime = 'Required';
  } else {
    const selectedTime = new Date(form.preferredDemoTime);

    if (Number.isNaN(selectedTime.getTime())) {
      nextErrors.preferredDemoTime = 'Choose a valid date and time';
    } else if (selectedTime.getTime() <= Date.now()) {
      nextErrors.preferredDemoTime = 'Choose a future date and time';
    }
  }

  if (designation.length > 120) {
    nextErrors.designation = 'Designation should be 120 characters or less';
  }

  if (message.length > 1000) {
    nextErrors.message = 'Message should be 1000 characters or less';
  }

  return nextErrors;
}

function FieldShell({ label, required, error, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-xs font-medium text-red-500">{error}</span>}
    </label>
  );
}

function InputShell({ Icon, children }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      {children}
    </div>
  );
}

const inputClass =
  'h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white';

export default function RequestDemo() {
  const { toast } = useToast();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const minPreferredDemoTime = formatLocalDatetimeValue();

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '', submit: '' }));
    setSubmitted(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || submitting) return;

    setSubmitting(true);

    const payload = {
      fullName: normalizeText(form.fullName),
      workEmail: normalizeText(form.workEmail).toLowerCase(),
      phoneNumber: normalizePhoneNumber(form.phoneNumber),
      companyName: normalizeText(form.companyName),
      companySize: normalizeText(form.companySize),
      designation: normalizeText(form.designation),
      preferredDemoTime: form.preferredDemoTime,
      message: normalizeText(form.message),
      source: 'CMS Demo Request',
    };

    try {
      const response = await fetch(`${API_URL}/demo-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data?.errors) {
          setErrors((prev) => ({ ...prev, ...data.errors }));
        }
        throw new Error(data?.message || 'Failed to submit demo request.');
      }

      setSubmitted(true);
      setForm(initialForm);
      setErrors({});
      toast({
        title: 'Demo request submitted successfully.',
        description: data?.message || 'Our team will contact you soon.',
      });
    } catch (error) {
      setErrors((prev) => ({ ...prev, submit: error.message || 'Failed to submit demo request.' }));
      toast({
        title: 'Could not submit demo request.',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-10">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white shadow-lg shadow-blue-600/20">
            V
          </span>
          <span className="min-w-0 break-words text-sm font-black tracking-tight sm:text-base">VTS Tracker</span>
        </Link>
        <Link
          to="/"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>
      </div>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-5 pb-8 pt-1 sm:px-8 lg:min-h-[calc(100vh-64px)] lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:px-10 lg:pb-8">
        <section className="min-w-0">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            <span className="break-words">Live CMS Demo Sessions</span>
          </div>

          <h1 className="mt-4 max-w-lg break-words text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-4xl">
            Transform Your Recruitment Operations with Smart CMS
          </h1>

          <p className="mt-3 max-w-lg break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Experience a complete Candidate Management System designed to simplify hiring, manage candidates, track clients, assign recruiters, schedule interviews, and view real-time recruitment reports.
          </p>

          <div className="mt-5 grid max-w-lg grid-cols-3 gap-2">
            {[
              ['30 min', 'Guided walkthrough'],
              ['Live', 'Workflow preview'],
              ['Zero', 'Credit card needed'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-lg font-black text-blue-600 dark:text-blue-300 sm:text-xl">{value}</p>
                <p className="mt-0.5 break-words text-[10px] font-semibold leading-snug text-slate-500 dark:text-slate-400 sm:text-[11px]">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm sm:p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="mb-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              What you will see
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {featurePoints.map(({ label, Icon }) => (
                <div
                  key={label}
                  className="flex min-w-0 items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/60"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 break-words text-[11px] font-semibold leading-relaxed text-slate-700 dark:text-slate-200">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="min-w-0">
          <form
            onSubmit={handleSubmit}
            className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30"
            noValidate
          >
            <div className="h-1.5 bg-blue-600" />
            <div className="border-b border-slate-100 bg-slate-50/70 p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="break-words text-lg font-black tracking-tight text-slate-950 dark:text-white sm:text-xl">
                Request a CMS Demo
              </h2>
              <p className="mt-1.5 break-words text-xs leading-relaxed text-slate-500 dark:text-slate-300 sm:text-sm">
                Fill in your details and our team will contact you for a personalized walkthrough.
              </p>
            </div>

            <div className="p-3.5 sm:p-4 lg:p-5">
              {errors.submit && (
                <div className="mb-3.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {errors.submit}
                </div>
              )}

              {submitted && (
                <div className="mb-3.5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">Demo request submitted successfully. Our team will contact you soon.</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FieldShell label="Full Name" required error={errors.fullName}>
                  <InputShell Icon={User}>
                    <input
                      className={inputClass}
                      maxLength={120}
                      value={form.fullName}
                      onChange={(event) => updateField('fullName', event.target.value)}
                      placeholder="Your full name"
                    />
                  </InputShell>
                </FieldShell>

                <FieldShell label="Work Email" required error={errors.workEmail}>
                  <InputShell Icon={Mail}>
                    <input
                      className={inputClass}
                      type="email"
                      maxLength={120}
                      value={form.workEmail}
                      onChange={(event) => updateField('workEmail', event.target.value)}
                      placeholder="name@company.com"
                    />
                  </InputShell>
                </FieldShell>

                <FieldShell label="Phone Number" required error={errors.phoneNumber}>
                  <InputShell Icon={Phone}>
                    <input
                      className={inputClass}
                      maxLength={25}
                      value={form.phoneNumber}
                      onChange={(event) => updateField('phoneNumber', event.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </InputShell>
                </FieldShell>

                <FieldShell label="Company Name" required error={errors.companyName}>
                  <InputShell Icon={Building2}>
                    <input
                      className={inputClass}
                      maxLength={120}
                      value={form.companyName}
                      onChange={(event) => updateField('companyName', event.target.value)}
                      placeholder="Your company"
                    />
                  </InputShell>
                </FieldShell>

                <FieldShell label="Company Size" required error={errors.companySize}>
                  <InputShell Icon={Users}>
                    <select
                      className={inputClass}
                      value={form.companySize}
                      onChange={(event) => updateField('companySize', event.target.value)}
                    >
                      <option value="">Select size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="500+">500+ employees</option>
                    </select>
                  </InputShell>
                </FieldShell>

                <FieldShell label="Preferred Demo Date & Time" required error={errors.preferredDemoTime}>
                  <InputShell Icon={Clock3}>
                    <input
                      className={inputClass}
                      type="datetime-local"
                      min={minPreferredDemoTime}
                      step="60"
                      value={form.preferredDemoTime}
                      onChange={(event) => updateField('preferredDemoTime', event.target.value)}
                    />
                  </InputShell>
                </FieldShell>

                <FieldShell label="Role / Designation" error={errors.designation}>
                  <InputShell Icon={BriefcaseBusiness}>
                    <input
                      className={inputClass}
                      maxLength={120}
                      value={form.designation}
                      onChange={(event) => updateField('designation', event.target.value)}
                      placeholder="HR Manager, Founder..."
                    />
                  </InputShell>
                </FieldShell>

                <div className="md:col-span-2">
                  <FieldShell label="Message" error={errors.message}>
                    <div className="flex min-w-0 gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900">
                      <MessageSquare className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                      <textarea
                        className="min-h-16 min-w-0 flex-1 resize-y bg-transparent text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                        value={form.message}
                        maxLength={1000}
                        onChange={(event) => updateField('message', event.target.value)}
                        placeholder="Tell us about your recruitment needs, team size, or features you are interested in..."
                      />
                    </div>
                  </FieldShell>
                </div>
              </div>

              <button
                disabled={submitting}
                type="submit"
                className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                  submitting ? 'cursor-not-allowed opacity-70 hover:bg-blue-600' : ''
                }`}
              >
                {submitting ? 'Scheduling...' : 'Schedule Your Demo'}
                <ArrowRight className="h-4 w-4" />
              </button>

              <p className="mt-2.5 break-words text-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
                No credit card required - 30-minute walkthrough
              </p>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
