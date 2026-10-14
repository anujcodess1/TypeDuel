import React from 'react';

export function LegalPages({ type }: { type: 'terms' | 'privacy' | 'license' | 'cookies' }) {
  if (type === 'privacy') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 prose dark:prose-invert">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted text-sm mb-6">Last updated: October 2026</p>
        <section className="space-y-4 text-sm text-[var(--text)]">
          <p>
            At TypeDuel, your privacy is important to us. This Privacy Policy outlines what information we collect and how we use it to provide our typing competition services.
          </p>
          <h2 className="text-lg font-bold mt-6 mb-2">1. Information We Collect</h2>
          <p>
            When registering, we collect your username, email address, and a cryptographically hashed representation of your password using Argon2id. We also record typing test results including duration, raw WPM, accuracy, and keystroke timestamps solely for anti-cheat validation.
          </p>
          <h2 className="text-lg font-bold mt-6 mb-2">2. Cookies and Storage</h2>
          <p>
            We use secure, httpOnly cookies for session authentication and token refresh rotation. Local storage is strictly used for client preferences such as visual theme (dark/light mode).
          </p>
          <h2 className="text-lg font-bold mt-6 mb-2">3. Data Retention & Deletion</h2>
          <p>
            You may delete your account and all associated test histories and statistics at any time through your Profile Settings page.
          </p>
        </section>
      </div>
    );
  }

  if (type === 'license') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">Software License</h1>
        <p className="text-muted text-sm mb-6">MIT License</p>
        <div className="card p-6 border border-default font-mono text-xs leading-relaxed text-muted bg-surface">
          <p className="mb-4">Copyright (c) 2026 TypeDuel Contributors</p>
          <p className="mb-4">
            Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the &quot;Software&quot;), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.
          </p>
          <p>
            THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
          </p>
        </div>
      </div>
    );
  }

  if (type === 'cookies') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">Cookie Policy</h1>
        <p className="text-muted text-sm mb-6">Last updated: October 2026</p>
        <section className="space-y-4 text-sm text-[var(--text)]">
          <p>
            TypeDuel uses strictly necessary cookies to ensure the secure and authenticated operation of our web application:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-muted">
            <li><strong>access_token:</strong> httpOnly, SameSite=Strict cookie used to authenticate API requests for 15 minutes.</li>
            <li><strong>refresh_token:</strong> httpOnly, SameSite=Strict cookie used to rotate authentication credentials securely.</li>
            <li><strong>csrf_token:</strong> Secure cookie protecting mutating POST/DELETE endpoints against cross-site request forgery.</li>
          </ul>
          <p>We do not use third-party advertising or tracker cookies.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
      <p className="text-muted text-sm mb-6">Last updated: October 2026</p>
      <section className="space-y-4 text-sm text-[var(--text)]">
        <p>
          Welcome to TypeDuel. By accessing or playing on our platform, you agree to comply with the following fair play and community terms.
        </p>
        <h2 className="text-lg font-bold mt-6 mb-2">1. Fair Play & Competitive Integrity</h2>
        <p>
          Automated keystroke input tools, browser extensions that intercept or automate DOM inputs, macro scripts, or packet manipulation tools are strictly prohibited. Detected infractions result in automatic trust penalties and account disqualification from ranked queues.
        </p>
        <h2 className="text-lg font-bold mt-6 mb-2">2. User Accounts</h2>
        <p>
          Users are responsible for safeguarding their login credentials. Offensive, impersonating, or abusive usernames may be renamed or suspended.
        </p>
      </section>
    </div>
  );
}
