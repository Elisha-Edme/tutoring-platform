import nodemailer from 'nodemailer'

interface EmailPayload {
  to: string
  replyTo?: string
  subject: string
  html: string
}

function getTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export async function sendEmail({ to, replyTo, subject, html }: EmailPayload): Promise<void> {
  const transport = getTransport()
  await transport.sendMail({
    from: `"Tune Up Together" <${process.env.GMAIL_USER}>`,
    to,
    ...(replyTo ? { replyTo } : {}),
    subject,
    html,
  })
}

export function lessonRequestEmailHtml({
  tutorName,
  parentName,
  parentEmail,
  childName,
  requestedDate,
  requestedStartTime,
  requestedEndTime,
  message,
  dashboardUrl,
}: {
  tutorName: string
  parentName: string
  parentEmail: string
  childName: string
  requestedDate: string
  requestedStartTime: string
  requestedEndTime: string
  message: string
  dashboardUrl: string
}): string {
  const formattedDate = new Date(`${requestedDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const fmt = (t: string) => {
    const [hStr, mStr] = t.split(':')
    const h = parseInt(hStr, 10)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${mStr} ${ampm}`
  }

  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">New lesson request</h2>
  <p style="color:#555;margin-top:0">Hi ${tutorName}, a parent has requested a lesson with you.</p>
  <table style="border-collapse:collapse;width:100%;margin:20px 0">
    <tr><td style="padding:8px 0;color:#888;width:140px">Parent</td><td style="padding:8px 0"><strong>${parentName}</strong></td></tr>
    <tr><td style="padding:8px 0;color:#888">Parent email</td><td style="padding:8px 0"><a href="mailto:${parentEmail}">${parentEmail}</a></td></tr>
    <tr><td style="padding:8px 0;color:#888">Child</td><td style="padding:8px 0">${childName}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Requested date</td><td style="padding:8px 0">${formattedDate}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Time</td><td style="padding:8px 0">${fmt(requestedStartTime)} – ${fmt(requestedEndTime)} EST</td></tr>
  </table>
  ${message ? `<p style="background:#f5f5f5;padding:12px 16px;border-radius:6px;margin:0 0 20px">"${message}"</p>` : ''}
  <p style="margin-bottom:4px">Reply directly to this email to get in touch with ${parentName}.</p>
  <p style="margin-top:0">Or <a href="${dashboardUrl}">open your dashboard</a> to manage this request.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}
