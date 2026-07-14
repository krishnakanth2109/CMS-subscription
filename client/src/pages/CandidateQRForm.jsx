// src/pages/CandidateQRForm.jsx
// ─── Public page: candidate scans QR, fills this form ───────────────────────
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const NOTICE_OPTIONS = [
  'Immediate', '15 Days', '30 Days', '45 Days', '60 Days', '90 Days', '> 90 Days'
];

const initialForm = {
  firstName: '', lastName: '', email: '', contact: '',
  alternateNumber: '', dateOfBirth: '', gender: '',
  currentLocation: '', preferredLocation: '', linkedin: '',
  position: '', currentCompany: '', totalExperience: '',
  relevantExperience: '', education: '', skills: '',
  ctc: '', ectc: '', noticePeriod: '',
};

export default function CandidateQRForm() {
  const { token } = useParams();

  const [sessionLabel, setSessionLabel] = useState('');
  const [status, setStatus] = useState('loading'); // loading | active | expired | invalid | submitted | error
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1 = personal, 2 = professional, 3 = compensation

  /* ── validate token (callable any time) ────────────────────────────────── */
  const validate = React.useCallback(async () => {
    if (!token) { setStatus('invalid'); return; }
    setStatus('loading');
    setErrorMsg('');
    try {
      // cache: 'no-store' tells the browser's fetch cache to skip the cache
      // without adding any custom headers that would trigger a CORS preflight
      const res = await fetch(`${API_URL}/candidate-qr/public/${token}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || 'This QR code is not valid.');
        setStatus('expired');
      } else {
        setSessionLabel(data.label || 'Candidate Registration');
        setStatus('active');
      }
    } catch {
      setErrorMsg('Unable to reach the server. Please try again later.');
      setStatus('error');
    }
  }, [token]);


  useEffect(() => { validate(); }, [validate]);

  const handleChange = (e) => {
    setErrorMsg('');
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < 3) { setStep(step + 1); return; }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/candidate-qr/public/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submission failed.');
      setStatus('submitted');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── screen states ─────────────────────────────────────────────────────── */
  if (status === 'loading') return <LoadingScreen />;
  // 'invalid' = truly broken token — no retry makes sense
  if (status === 'invalid') return <StatusScreen icon="🚫" title="QR Code Unavailable" message="This QR code is invalid." />;
  // 'expired' = deactivated or expired — show retry so admin re-activation works
  if (status === 'expired') return <StatusScreen icon="⏸️" title="QR Code Unavailable" message={errorMsg || 'This QR code has been deactivated or has expired.'} retry={validate} />;
  if (status === 'error')   return <StatusScreen icon="⚠️" title="Something went wrong" message={errorMsg} retry={validate} />;
  if (status === 'submitted') return <SuccessScreen label={sessionLabel} />;

  /* ── form ──────────────────────────────────────────────────────────────── */
  const stepLabels = ['Personal Info', 'Professional Info', 'Compensation'];
  const totalSteps = 3;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoIcon}>
            <span style={{ fontSize: 22 }}>📋</span>
          </div>
          <div>
            <h1 style={styles.headerTitle}>{sessionLabel}</h1>
            <p style={styles.headerSub}>Arah Infotech · Candidate Registration</p>
          </div>
        </div>
      </div>

      <div style={styles.container}>
        {/* Progress */}
        <div style={styles.progressRow}>
          {stepLabels.map((label, idx) => {
            const i = idx + 1;
            const done = i < step;
            const active = i === step;
            return (
              <React.Fragment key={label}>
                <div style={styles.stepItem}>
                  <div style={{
                    ...styles.stepCircle,
                    background: done ? '#10b981' : active ? '#6366f1' : '#e5e7eb',
                    color: done || active ? '#fff' : '#9ca3af',
                    boxShadow: active ? '0 0 0 3px rgba(99,102,241,0.25)' : 'none',
                  }}>
                    {done ? '✓' : i}
                  </div>
                  <span style={{ ...styles.stepLabel, color: active ? '#6366f1' : done ? '#10b981' : '#9ca3af' }}>{label}</span>
                </div>
                {idx < totalSteps - 1 && (
                  <div style={{ ...styles.stepLine, background: done ? '#10b981' : '#e5e7eb' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Card */}
        <div style={styles.card}>
          <form onSubmit={handleSubmit}>
            {step === 1 && <PersonalStep form={form} onChange={handleChange} />}
            {step === 2 && <ProfessionalStep form={form} onChange={handleChange} />}
            {step === 3 && <CompensationStep form={form} onChange={handleChange} />}

            {errorMsg && (
              <div style={{
                color: '#b91c1c',
                background: '#fef2f2',
                border: '1.5px solid #fca5a5',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '500',
                marginBottom: '16px',
                lineHeight: '1.5',
                textAlign: 'left'
              }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <div style={styles.btnRow}>
              {step > 1 && (
                <button type="button" onClick={() => { setErrorMsg(''); setStep(step - 1); }} style={styles.btnBack}>
                  ← Back
                </button>
              )}
              <button type="submit" style={{ ...styles.btnNext, opacity: submitting ? 0.7 : 1 }} disabled={submitting}>
                {submitting ? 'Submitting…' : step === totalSteps ? '✓ Submit' : 'Next →'}
              </button>
            </div>
          </form>
        </div>

        <p style={styles.footer}>Your data is secure and only used for recruitment purposes.</p>
      </div>
    </div>
  );
}

/* ── Step Components ────────────────────────────────────────────────────────── */

function PersonalStep({ form, onChange }) {
  return (
    <div>
      <h2 style={styles.stepTitle}>Personal Information</h2>
      <div style={styles.grid2}>
        <Field label="First Name *" name="firstName" value={form.firstName} onChange={onChange} required placeholder="John" />
        <Field label="Last Name" name="lastName" value={form.lastName} onChange={onChange} placeholder="Doe" />
      </div>
      <div style={styles.grid2}>
        <Field label="Email *" name="email" type="email" value={form.email} onChange={onChange} required placeholder="john@example.com" />
        <Field label="Mobile *" name="contact" type="tel" value={form.contact} onChange={onChange} required placeholder="+91 9876543210" />
      </div>
      <div style={styles.grid2}>
        <Field label="Alternate Number" name="alternateNumber" type="tel" value={form.alternateNumber} onChange={onChange} placeholder="+91 9876543210" />
        <Field label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={onChange} />
      </div>
      <div style={styles.grid2}>
        <SelectField label="Gender" name="gender" value={form.gender} onChange={onChange} options={['Male', 'Female', 'Other']} />
        <Field label="LinkedIn Profile" name="linkedin" value={form.linkedin} onChange={onChange} placeholder="linkedin.com/in/..." />
      </div>
      <div style={styles.grid2}>
        <Field label="Current Location" name="currentLocation" value={form.currentLocation} onChange={onChange} placeholder="Mumbai, Maharashtra" />
        <Field label="Preferred Location" name="preferredLocation" value={form.preferredLocation} onChange={onChange} placeholder="Bangalore, Karnataka" />
      </div>
    </div>
  );
}

function ProfessionalStep({ form, onChange }) {
  return (
    <div>
      <h2 style={styles.stepTitle}>Professional Information</h2>
      <div style={styles.grid2}>
        <Field label="Applied Position" name="position" value={form.position} onChange={onChange} placeholder="Software Engineer" />
        <Field label="Current Company" name="currentCompany" value={form.currentCompany} onChange={onChange} placeholder="ABC Pvt Ltd" />
      </div>
      <div style={styles.grid2}>
        <Field label="Total Experience (yrs)" name="totalExperience" value={form.totalExperience} onChange={onChange} placeholder="5" />
        <Field label="Relevant Experience (yrs)" name="relevantExperience" value={form.relevantExperience} onChange={onChange} placeholder="3" />
      </div>
      <Field label="Highest Education" name="education" value={form.education} onChange={onChange} placeholder="B.Tech in Computer Science" />
      <TextareaField label="Key Skills (comma separated)" name="skills" value={form.skills} onChange={onChange} placeholder="React, Node.js, MongoDB, AWS…" rows={3} />
    </div>
  );
}

function CompensationStep({ form, onChange }) {
  return (
    <div>
      <h2 style={styles.stepTitle}>Compensation & Availability</h2>
      <div style={styles.grid2}>
        <Field label="Current CTC (LPA)" name="ctc" value={form.ctc} onChange={onChange} placeholder="8.5" />
        <Field label="Expected CTC (LPA)" name="ectc" value={form.ectc} onChange={onChange} placeholder="12" />
      </div>
      <SelectField label="Notice Period" name="noticePeriod" value={form.noticePeriod} onChange={onChange}
        options={['Immediate', '15 Days', '30 Days', '45 Days', '60 Days', '90 Days', '> 90 Days']}
      />
      <div style={styles.consentBox}>
        <input type="checkbox" id="consent" required style={{ marginRight: 8, marginTop: 2, flexShrink: 0 }} />
        <label htmlFor="consent" style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
          I consent to Arah Infotech storing and processing my personal data for recruitment purposes.
        </label>
      </div>
    </div>
  );
}

/* ── Reusable form atoms ─────────────────────────────────────────────────────── */

function Field({ label, name, value, onChange, type = 'text', required, placeholder }) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <input
        style={styles.input}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        onFocus={(e) => e.target.style.borderColor = '#6366f1'}
        onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
      />
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <select name={name} value={value} onChange={onChange} style={styles.input}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TextareaField({ label, name, value, onChange, placeholder, rows = 3 }) {
  return (
    <div style={{ ...styles.fieldWrap, gridColumn: '1/-1' }}>
      <label style={styles.label}>{label}</label>
      <textarea
        name={name} value={value} onChange={onChange} rows={rows}
        placeholder={placeholder}
        style={{ ...styles.input, height: 'auto', resize: 'vertical' }}
        onFocus={(e) => e.target.style.borderColor = '#6366f1'}
        onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
      />
    </div>
  );
}

/* ── Status screens ─────────────────────────────────────────────────────────── */

function LoadingScreen() {
  return (
    <div style={{ ...styles.page, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={styles.spinner} />
      <p style={{ color: '#6b7280', fontSize: 15, fontFamily: 'Inter, sans-serif' }}>Validating QR Code…</p>
    </div>
  );
}

function StatusScreen({ icon, title, message, retry }) {
  return (
    <div style={{ ...styles.page, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={styles.statusCard}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>{icon}</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>{title}</h2>
        <p style={{ color: '#6b7280', textAlign: 'center', fontSize: 14, fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>{message}</p>
        {retry && (
          <button onClick={retry} style={{ ...styles.btnNext, marginTop: 20, width: '100%' }}>Try Again</button>
        )}
      </div>
    </div>
  );
}

function SuccessScreen({ label }) {
  return (
    <div style={{ ...styles.page, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={styles.statusCard}>
        <div style={{ fontSize: 60, marginBottom: 12 }}>🎉</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>
          Form Submitted!
        </h2>
        <p style={{ color: '#6b7280', textAlign: 'center', fontSize: 14, fontFamily: 'Inter, sans-serif', lineHeight: 1.7 }}>
          Thank you! Your details have been received for <strong>{label}</strong>.<br />
          Our team will be in touch with you shortly.
        </p>
        <div style={{ marginTop: 20, padding: '12px 20px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: '#16a34a', fontFamily: 'Inter, sans-serif' }}>✓ Application received successfully</span>
        </div>
      </div>
    </div>
  );
}

/* ── Inline styles ──────────────────────────────────────────────────────────── */
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  header: {
    background: 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255,255,255,0.2)',
    padding: '16px 24px',
  },
  headerInner: {
    maxWidth: 600,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    color: '#fff',
  },
  headerSub: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  container: {
    flex: 1,
    maxWidth: 600,
    width: '100%',
    margin: '0 auto',
    padding: '24px 16px 40px',
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    transition: 'all 0.3s',
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    whiteSpace: 'nowrap',
  },
  stepLine: {
    flex: 1,
    height: 2,
    margin: '0 6px',
    marginBottom: 18,
    borderRadius: 2,
    transition: 'background 0.3s',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    padding: '28px 24px',
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: '2px solid #f3f4f6',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '0 16px',
  },
  fieldWrap: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 5,
    letterSpacing: 0.3,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid #e5e7eb',
    borderRadius: 10,
    fontSize: 14,
    color: '#1f2937',
    outline: 'none',
    background: '#fafafa',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    fontFamily: "'Inter', sans-serif",
  },
  consentBox: {
    display: 'flex',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 14,
    background: '#f8faff',
    borderRadius: 10,
    border: '1px solid #e0e7ff',
  },
  btnRow: {
    display: 'flex',
    gap: 12,
    marginTop: 24,
  },
  btnBack: {
    padding: '12px 20px',
    border: '1.5px solid #e5e7eb',
    borderRadius: 12,
    background: '#fff',
    color: '#374151',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
  },
  btnNext: {
    flex: 1,
    padding: '12px 20px',
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
    transition: 'opacity 0.2s',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 20,
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid rgba(255,255,255,0.3)',
    borderTop: '3px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  statusCard: {
    background: '#fff',
    borderRadius: 20,
    padding: '36px 28px',
    width: '100%',
    maxWidth: 380,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
};
