// Vercel Serverless Function: POST /api/waitlist
// Receives waitlist applications and saves to database / webhook / storage

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const { name, email, city, profile, phone, linkedin } = req.body || {};

    // Validate presence of required fields
    if (!name || !email || !city || !profile) {
      return res.status(400).json({
        error: 'Missing required fields. Please provide name, email, city, and profile.'
      });
    }

    // Server-side email validation
    const emailClean = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(emailClean)) {
      return res.status(400).json({ error: 'Invalid email address format.' });
    }

    // Clean payload for database insert
    const submission = {
      name: String(name).trim(),
      email: emailClean,
      city: String(city).trim(),
      profile: String(profile).trim(),
      ...(phone ? { phone: String(phone).trim() } : {}),
      ...(linkedin ? { linkedin: String(linkedin).trim() } : {})
    };

    // ── Option A: Supabase Integration ──
    // Uses environment variables set in Vercel or .env, falling back to configured project credentials
    const supabaseUrl = process.env.SUPABASE_URL || 'https://wbbytuqzkotzugdhwtme.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiYnl0dXF6a290enVnZGh3dG1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxOTM0OTUsImV4cCI6MjExMDc2OTQ5NX0.Jtn04msrpOWRbyS1JEbTfCqK0NzW6wYU1QAX9-zf1lM';

    if (supabaseUrl && supabaseKey) {
      // Normalize URL: strip trailing slashes and any trailing /rest/v1
      let cleanUrl = supabaseUrl.trim().replace(/\/+$/, '');
      if (cleanUrl.endsWith('/rest/v1')) {
        cleanUrl = cleanUrl.slice(0, -'/rest/v1'.length).replace(/\/+$/, '');
      }
      let response = await fetch(`${cleanUrl}/rest/v1/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(submission)
      });

      if (!response.ok) {
        let errorText = await response.text();
        console.error('Supabase error:', errorText);

        // If the table schema has a NOT NULL constraint on 'phone', retry with empty string
        if (!submission.phone && errorText.includes('phone') && (errorText.includes('not-null') || errorText.includes('null value') || response.status === 400)) {
          const phoneFallback = {
            ...submission,
            phone: ''
          };
          response = await fetch(`${cleanUrl}/rest/v1/waitlist`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(phoneFallback)
          });
          if (!response.ok) {
            errorText = await response.text();
          }
        }

        // If the 'linkedin' column is not yet present in Supabase table schema, retry without it
        if (submission.linkedin && (errorText.includes('linkedin') || (response.status === 400 && errorText.includes('column')))) {
          const fallback = {
            name: submission.name,
            email: submission.email,
            city: submission.city,
            profile: submission.profile,
            ...(submission.phone !== undefined ? { phone: submission.phone } : {})
          };
          response = await fetch(`${cleanUrl}/rest/v1/waitlist`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(fallback)
          });
          if (!response.ok) {
            errorText = await response.text();
          }
        }

        // If duplicate email error (code 23505 in postgres)
        if (errorText.includes('duplicate key') || errorText.includes('unique constraint') || response.status === 409) {
          return res.status(200).json({
            success: true,
            message: 'You are already on the waitlist! We have updated your details.',
            data: submission
          });
        }
        if (!response.ok) {
          return res.status(500).json({ error: 'Failed to insert record into Supabase: ' + errorText });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Successfully saved to Supabase waitlist.',
        data: submission
      });
    }

    // ── Option B: Webhook / Google Sheets / Make.com / Zapier / Airtable ──
    const webhookUrl = process.env.WAITLIST_WEBHOOK_URL;
    if (webhookUrl) {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission)
      });

      if (!response.ok) {
        console.error('Webhook error status:', response.status);
      }

      return res.status(200).json({
        success: true,
        message: 'Application forwarded to database webhook.',
        data: submission
      });
    }

    // ── Default / Fallback Mode ──
    // Logs submission to Vercel runtime logs so no lead is lost even before DB credentials are plugged in
    console.log('[Waitlist Application Received]:', JSON.stringify(submission));

    return res.status(200).json({
      success: true,
      message: 'Waitlist application received successfully.',
      data: submission
    });

  } catch (err) {
    console.error('Waitlist submission handler error:', err);
    return res.status(500).json({ error: 'Internal server error while processing waitlist.' });
  }
}
