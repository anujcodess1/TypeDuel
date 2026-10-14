import React, { useState } from 'react';
import { api } from '@/services/api';
import { toast } from '@/store/toast';
import { Mail, Send, CheckCircle2 } from 'lucide-react';

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [mountTime] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.contact.submit({
        name,
        email,
        subject,
        message,
        _submitTime: mountTime,
      });
      setSubmitted(true);
      toast('Your message has been sent!', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to send message', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Message Sent</h1>
        <p className="text-muted text-sm mb-6">
          Thank you for reaching out. We will review your inquiry and get back to you shortly.
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setName('');
            setEmail('');
            setSubject('');
            setMessage('');
          }}
          className="btn-secondary"
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold uppercase tracking-wider mb-3">
          <Mail size={14} /> Get In Touch
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Contact Us</h1>
        <p className="text-muted text-sm">
          Have feedback, found a bug, or want to partner? Send us a message below.
        </p>
      </div>

      <div className="card p-6 sm:p-8 border border-default">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              Subject
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Question about tournaments / feature request"
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              Message
            </label>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help you?"
              className="input-field w-full resize-y"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? 'Sending...' : 'Send Message'} <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
