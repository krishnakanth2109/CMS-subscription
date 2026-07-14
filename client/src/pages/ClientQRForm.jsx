// src/pages/ClientQRForm.jsx
// ─── Public page: company scans QR, fills this form ─────────────────────────
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const initialForm = {
  // Company
  companyName: '', industry: '', website: '', companySize: '',
  address: '', city: '', state: '', country: '', gstNumber: '',
  // Contact
  contactPerson: '', designation: '', email: '', phone: '',
  alternatePhone: '', linkedin: '',
  // Hiring
  hiringFor: '', hiringVolume: '', urgency: '', budgetRange: '',
  preferredEngagement: '', notes: '',
};

const INDUSTRIES = [
  'IT & Software', 'BFSI', 'Healthcare', 'Manufacturing', 'Retail',
  'Education', 'E-Commerce', 'Logistics', 'Real Estate', 'Consulting',
  'Media & Entertainment', 'Pharma', 'Automotive', 'FMCG', 'Other',
];

const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–500', '501–1000', '1000+'];
const URGENCY_OPTIONS = ['Immediate', 'Within 1 Month', '1–3 Months', 'Flexible'];
const ENGAGEMENT_OPTIONS = ['Permanent', 'Contract', 'Both'];

export default function ClientQRForm() {
  const { token } = useParams();

  const [sessionLabel, setSessionLabel] = useState('');
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1=Company, 2=Contact, 3=Hiring

  /* ── validate token ──────────────────────────────────────────────────────── */
  const validate = React.useCallback(async () => {
    if (!token) { setStatus('invalid'); return; }
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/client-qr/public/${token}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || 'This QR code is not valid.');
        setStatus('expired');
      } else {
        setSessionLabel(data.label || 'Client / Company Registration');
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
      const res = await fetch(`${API_URL}/client-qr/public/${token}/submit`, {
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

  /* ── states ──────────────────────────────────────────────────────────────── */
  if (status === 'loading')   return <LoadingScreen />;
  if (status === 'invalid')   return <StatusScreen icon="🚫" title="QR Code Unavailable" message="This QR code is invalid." />;
  if (status === 'expired')   return <StatusScreen icon="⏸️" title="QR Code Unavailable" message={errorMsg} retry={validate} />;
  if (status === 'error')     return <StatusScreen icon="⚠️" title="Something went wrong" message={errorMsg} retry={validate} />;
  if (status === 'submitted') return <SuccessScreen label={sessionLabel} />;

  const stepLabels = ['Company Info', 'Contact Person', 'Hiring Needs'];

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerInner}>
          <div style={s.logoIcon}><span style={{ fontSize: 22 }}>🏢</span></div>
          <div>
            <h1 style={s.headerTitle}>{sessionLabel}</h1>
            <p style={s.headerSub}>Arah Infotech · Company Registration</p>
          </div>
        </div>
      </div>

      <div style={s.container}>
        {/* Progress */}
        <div style={s.progressRow}>
          {stepLabels.map((label, idx) => {
            const i = idx + 1;
            const done = i < step, active = i === step;
            return (
              <React.Fragment key={label}>
                <div style={s.stepItem}>
                  <div style={{ ...s.stepCircle, background: done ? '#10b981' : active ? '#0ea5e9' : '#e5e7eb', color: done || active ? '#fff' : '#9ca3af', boxShadow: active ? '0 0 0 3px rgba(14,165,233,0.25)' : 'none' }}>
                    {done ? '✓' : i}
                  </div>
                  <span style={{ ...s.stepLabel, color: active ? '#0ea5e9' : done ? '#10b981' : '#9ca3af' }}>{label}</span>
                </div>
                {idx < stepLabels.length - 1 && (
                  <div style={{ ...s.stepLine, background: done ? '#10b981' : '#e5e7eb' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Card */}
        <div style={s.card}>
          <form onSubmit={handleSubmit}>
            {step === 1 && <CompanyStep form={form} onChange={handleChange} />}
            {step === 2 && <ContactStep form={form} onChange={handleChange} />}
            {step === 3 && <HiringStep  form={form} onChange={handleChange} />}

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

            <div style={s.btnRow}>
              {step > 1 && (
                <button type="button" onClick={() => { setErrorMsg(''); setStep(step - 1); }} style={s.btnBack}>← Back</button>
              )}
              <button type="submit" style={{ ...s.btnNext, opacity: submitting ? 0.7 : 1 }} disabled={submitting}>
                {submitting ? 'Submitting…' : step === 3 ? '✓ Submit' : 'Next →'}
              </button>
            </div>
          </form>
        </div>

        <p style={s.footer}>Your data is secure and only used for business purposes.</p>
      </div>
    </div>
  );
}

/* ── Step Components ─────────────────────────────────────────────────────────── */

function CompanyStep({ form, onChange }) {
  return (
    <div>
      <h2 style={s.stepTitle}>Company Information</h2>
      <Field label="Company Name *" name="companyName" value={form.companyName} onChange={onChange} required placeholder="Acme Technologies Pvt Ltd" />
      <div style={s.grid2}>
        <SelectField label="Industry" name="industry" value={form.industry} onChange={onChange} options={INDUSTRIES} />
        <SelectField label="Company Size" name="companySize" value={form.companySize} onChange={onChange} options={COMPANY_SIZES} />
      </div>
      <div style={s.grid2}>
        <Field label="Website" name="website" value={form.website} onChange={onChange} placeholder="https://acme.com" />
        <Field label="GST Number" name="gstNumber" value={form.gstNumber} onChange={onChange} placeholder="22AAAAA0000A1Z5" />
      </div>
      <Field label="Address" name="address" value={form.address} onChange={onChange} placeholder="Street / Building" />
      <div style={s.grid3}>
        <Field label="City" name="city" value={form.city} onChange={onChange} placeholder="Mumbai" />
        <Field label="State" name="state" value={form.state} onChange={onChange} placeholder="Maharashtra" />
        <Field label="Country" name="country" value={form.country} onChange={onChange} placeholder="India" />
      </div>
    </div>
  );
}

function ContactStep({ form, onChange }) {
  return (
    <div>
      <h2 style={s.stepTitle}>Contact Person Details</h2>
      <div style={s.grid2}>
        <Field label="Contact Person *" name="contactPerson" value={form.contactPerson} onChange={onChange} placeholder="Rahul Sharma" />
        <Field label="Designation" name="designation" value={form.designation} onChange={onChange} placeholder="HR Manager" />
      </div>
      <div style={s.grid2}>
        <Field label="Email *" name="email" type="email" value={form.email} onChange={onChange} required placeholder="hr@acme.com" />
        <Field label="Phone *" name="phone" type="tel" value={form.phone} onChange={onChange} required placeholder="+91 9876543210" />
      </div>
      <div style={s.grid2}>
        <Field label="Alternate Phone" name="alternatePhone" type="tel" value={form.alternatePhone} onChange={onChange} placeholder="+91 9876543210" />
        <Field label="LinkedIn" name="linkedin" value={form.linkedin} onChange={onChange} placeholder="linkedin.com/in/rahul" />
      </div>
    </div>
  );
}

function HiringStep({ form, onChange }) {
  return (
    <div>
      <h2 style={s.stepTitle}>Hiring Requirements</h2>
      <Field label="Hiring For (Roles)" name="hiringFor" value={form.hiringFor} onChange={onChange} placeholder="Software Engineers, Data Analysts…" />
      <div style={s.grid2}>
        <Field label="No. of Positions" name="hiringVolume" value={form.hiringVolume} onChange={onChange} placeholder="5" />
        <Field label="Budget Range (LPA)" name="budgetRange" value={form.budgetRange} onChange={onChange} placeholder="8–15 LPA" />
      </div>
      <div style={s.grid2}>
        <SelectField label="Urgency" name="urgency" value={form.urgency} onChange={onChange} options={URGENCY_OPTIONS} />
        <SelectField label="Engagement Type" name="preferredEngagement" value={form.preferredEngagement} onChange={onChange} options={ENGAGEMENT_OPTIONS} />
      </div>
      <TextareaField label="Additional Notes" name="notes" value={form.notes} onChange={onChange} placeholder="Any specific requirements, tech stack, etc." rows={3} />
      <div style={s.consentBox}>
        <input type="checkbox" id="consent" required style={{ marginRight: 8, marginTop: 2, flexShrink: 0 }} />
        <label htmlFor="consent" style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
          I consent to Arah Infotech storing and processing the provided company data for recruitment partnership purposes.
        </label>
      </div>
    </div>
  );
}

/* ── Reusable atoms ──────────────────────────────────────────────────────────── */

function Field({ label, name, value, onChange, type = 'text', required, placeholder }) {
  return (
    <div style={s.fieldWrap}>
      <label style={s.label}>{label}</label>
      <input style={s.input} type={type} name={name} value={value} onChange={onChange}
        required={required} placeholder={placeholder}
        onFocus={(e) => e.target.style.borderColor = '#0ea5e9'}
        onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
      />
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div style={s.fieldWrap}>
      <label style={s.label}>{label}</label>
      <select name={name} value={value} onChange={onChange} style={s.input}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TextareaField({ label, name, value, onChange, placeholder, rows = 3 }) {
  return (
    <div style={{ ...s.fieldWrap }}>
      <label style={s.label}>{label}</label>
      <textarea name={name} value={value} onChange={onChange} rows={rows}
        placeholder={placeholder}
        style={{ ...s.input, height: 'auto', resize: 'vertical' }}
        onFocus={(e) => e.target.style.borderColor = '#0ea5e9'}
        onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
      />
    </div>
  );
}

/* ── Status screens ──────────────────────────────────────────────────────────── */

function LoadingScreen() {
  return (
    <div style={{ ...s.page, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={s.spinner} /><p style={{ color: '#e0f2fe', fontSize: 15, fontFamily: 'Inter, sans-serif' }}>Validating QR Code…</p>
    </div>
  );
}

function StatusScreen({ icon, title, message, retry }) {
  return (
    <div style={{ ...s.page, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={s.statusCard}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>{icon}</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>{title}</h2>
        <p style={{ color: '#6b7280', textAlign: 'center', fontSize: 14, fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>{message}</p>
        {retry && <button onClick={retry} style={{ ...s.btnNext, marginTop: 20, width: '100%' }}>Try Again</button>}
      </div>
    </div>
  );
}

function SuccessScreen({ label }) {
  return (
    <div style={{ ...s.page, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={s.statusCard}>
        <div style={{ fontSize: 60, marginBottom: 12 }}>🎉</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>Details Submitted!</h2>
        <p style={{ color: '#6b7280', textAlign: 'center', fontSize: 14, fontFamily: 'Inter, sans-serif', lineHeight: 1.7 }}>
          Thank you! Your company details have been received for <strong>{label}</strong>.<br />
          Our recruitment team will reach out to you shortly.
        </p>
        <div style={{ marginTop: 20, padding: '12px 20px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: '#16a34a', fontFamily: 'Inter, sans-serif' }}>✓ Company registration received successfully</span>
        </div>
      </div>
    </div>
  );
}

/* ── Inline styles ───────────────────────────────────────────────────────────── */
const s = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 50%, #075985 100%)', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', 'Segoe UI', sans-serif" },
  header: { background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.18)', padding: '16px 24px' },
  headerInner: { maxWidth: 620, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 },
  logoIcon: { width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerTitle: { margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' },
  headerSub: { margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  container: { flex: 1, maxWidth: 620, width: '100%', margin: '0 auto', padding: '24px 16px 40px' },
  progressRow: { display: 'flex', alignItems: 'center', marginBottom: 24 },
  stepItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 },
  stepCircle: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, transition: 'all 0.3s' },
  stepLabel: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' },
  stepLine: { flex: 1, height: 2, margin: '0 6px', marginBottom: 18, borderRadius: 2, transition: 'background 0.3s' },
  card: { background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '28px 24px' },
  stepTitle: { fontSize: 17, fontWeight: 700, color: '#1f2937', marginBottom: 20, paddingBottom: 12, borderBottom: '2px solid #f0f9ff' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 16px' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0 16px' },
  fieldWrap: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, letterSpacing: 0.3 },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, color: '#1f2937', outline: 'none', background: '#fafafa', boxSizing: 'border-box', transition: 'border-color 0.2s', fontFamily: "'Inter', sans-serif" },
  consentBox: { display: 'flex', alignItems: 'flex-start', marginTop: 16, padding: 14, background: '#f0f9ff', borderRadius: 10, border: '1px solid #bae6fd' },
  btnRow: { display: 'flex', gap: 12, marginTop: 24 },
  btnBack: { padding: '12px 20px', border: '1.5px solid #e5e7eb', borderRadius: 12, background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  btnNext: { flex: 1, padding: '12px 20px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg, #0ea5e9, #0369a1)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'Inter', sans-serif", boxShadow: '0 4px 15px rgba(14,165,233,0.35)', transition: 'opacity 0.2s' },
  footer: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 20 },
  spinner: { width: 40, height: 40, border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  statusCard: { background: '#fff', borderRadius: 20, padding: '36px 28px', width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
};
