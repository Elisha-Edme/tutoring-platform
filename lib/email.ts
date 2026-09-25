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

function formatDateLong(requestedDate: string): string {
  return new Date(`${requestedDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function formatTime12h(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${mStr} ${ampm}`
}

export function lessonAcceptedEmailHtml({
  parentName, tutorName, childName, requestedDate, requestedStartTime, requestedEndTime, dashboardUrl,
}: {
  parentName: string
  tutorName: string
  childName: string
  requestedDate: string
  requestedStartTime: string
  requestedEndTime: string
  dashboardUrl: string
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">Your lesson request was accepted</h2>
  <p style="color:#555;margin-top:0">Hi ${parentName}, ${tutorName} accepted the lesson request for ${childName}.</p>
  <table style="border-collapse:collapse;width:100%;margin:20px 0">
    <tr><td style="padding:8px 0;color:#888;width:140px">Date</td><td style="padding:8px 0">${formatDateLong(requestedDate)}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Time</td><td style="padding:8px 0">${formatTime12h(requestedStartTime)} – ${formatTime12h(requestedEndTime)} EST</td></tr>
  </table>
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> to view the details.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function lessonCancelledEmailHtml({
  parentName, tutorName, childName, requestedDate, requestedStartTime, requestedEndTime, declineReason, dashboardUrl,
}: {
  parentName: string
  tutorName: string
  childName: string
  requestedDate: string
  requestedStartTime: string
  requestedEndTime: string
  declineReason?: string
  dashboardUrl: string
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">Lesson request cancelled</h2>
  <p style="color:#555;margin-top:0">Hi ${parentName}, ${tutorName} cancelled the lesson request for ${childName}.</p>
  <table style="border-collapse:collapse;width:100%;margin:20px 0">
    <tr><td style="padding:8px 0;color:#888;width:140px">Date</td><td style="padding:8px 0">${formatDateLong(requestedDate)}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Time</td><td style="padding:8px 0">${formatTime12h(requestedStartTime)} – ${formatTime12h(requestedEndTime)} EST</td></tr>
    ${declineReason ? `<tr><td style="padding:8px 0;color:#888">Reason</td><td style="padding:8px 0">${declineReason}</td></tr>` : ''}
  </table>
  <p style="margin-top:0">You can <a href="${dashboardUrl}">browse tutors</a> and request another lesson any time.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function lessonCancelledByParentEmailHtml({
  tutorName, parentName, childName, requestedDate, requestedStartTime, requestedEndTime, dashboardUrl,
}: {
  tutorName: string
  parentName: string
  childName: string
  requestedDate: string
  requestedStartTime: string
  requestedEndTime: string
  dashboardUrl: string
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">A lesson was cancelled</h2>
  <p style="color:#555;margin-top:0">Hi ${tutorName}, ${parentName} cancelled the upcoming lesson with ${childName}.</p>
  <table style="border-collapse:collapse;width:100%;margin:20px 0">
    <tr><td style="padding:8px 0;color:#888;width:140px">Date</td><td style="padding:8px 0">${formatDateLong(requestedDate)}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Time</td><td style="padding:8px 0">${formatTime12h(requestedStartTime)} – ${formatTime12h(requestedEndTime)} EST</td></tr>
  </table>
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> to see your other upcoming lessons.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function tutorSummaryReminderEmailHtml({
  tutorName, childName, occurrenceDate, occurrenceStartTime, occurrenceEndTime, thresholdMinutes, dashboardUrl,
}: {
  tutorName: string
  childName: string
  occurrenceDate: string
  occurrenceStartTime: string
  occurrenceEndTime: string
  thresholdMinutes: number
  dashboardUrl: string
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">Don't forget your lesson summary</h2>
  <p style="color:#555;margin-top:0">
    Hi ${tutorName}, it's been ${thresholdMinutes} minutes since your lesson with ${childName}
    on ${formatDateLong(occurrenceDate)} (${formatTime12h(occurrenceStartTime)} – ${formatTime12h(occurrenceEndTime)} EST)
    and a summary hasn't been added yet.
  </p>
  <p style="margin-top:0">
    <a href="${dashboardUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px">
      Write summary
    </a>
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function lessonSummaryReadyEmailHtml({
  parentName, tutorName, childName, occurrenceDate, summary, dashboardUrl,
}: {
  parentName: string
  tutorName: string
  childName: string
  occurrenceDate: string
  summary: string
  dashboardUrl: string
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">Lesson summary from ${tutorName}</h2>
  <p style="color:#555;margin-top:0">
    Hi ${parentName}, here's ${tutorName}'s summary from ${childName}'s lesson on ${formatDateLong(occurrenceDate)}:
  </p>
  <p style="background:#f5f5f5;padding:12px 16px;border-radius:6px;margin:0 0 20px">${summary}</p>
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> to see it any time.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function preLessonReminderEmailHtml({
  audience, recipientName, tutorName, childName, occurrenceDate, occurrenceStartTime, occurrenceEndTime, thresholdHours, dashboardUrl,
}: {
  audience: 'parent' | 'tutor'
  recipientName: string
  tutorName: string
  childName: string
  occurrenceDate: string
  occurrenceStartTime: string
  occurrenceEndTime: string
  thresholdHours: 24 | 1
  dashboardUrl: string
}): string {
  const when = thresholdHours === 24 ? 'tomorrow' : 'in about an hour'
  const withWhom = audience === 'parent' ? `with ${tutorName}` : `with ${childName}`
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">Upcoming lesson ${when}</h2>
  <p style="color:#555;margin-top:0">
    Hi ${recipientName}, this is a reminder that a lesson ${withWhom} is coming up ${when}.
  </p>
  <table style="border-collapse:collapse;width:100%;margin:20px 0">
    <tr><td style="padding:8px 0;color:#888;width:140px">Date</td><td style="padding:8px 0">${formatDateLong(occurrenceDate)}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Time</td><td style="padding:8px 0">${formatTime12h(occurrenceStartTime)} – ${formatTime12h(occurrenceEndTime)} EST</td></tr>
  </table>
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> for details.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function lessonScheduledEmailHtml({
  parentName, tutorName, childName, requestedDate, requestedStartTime, requestedEndTime, recurrenceLabel, dashboardUrl,
}: {
  parentName: string
  tutorName: string
  childName: string
  requestedDate: string
  requestedStartTime: string
  requestedEndTime: string
  recurrenceLabel: string
  dashboardUrl: string
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">${tutorName} scheduled a lesson for ${childName}</h2>
  <p style="color:#555;margin-top:0">Hi ${parentName}, ${tutorName} scheduled an upcoming lesson with ${childName}. It's confirmed — no action needed from you.</p>
  <table style="border-collapse:collapse;width:100%;margin:20px 0">
    <tr><td style="padding:8px 0;color:#888;width:140px">First lesson</td><td style="padding:8px 0">${formatDateLong(requestedDate)}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Time</td><td style="padding:8px 0">${formatTime12h(requestedStartTime)} – ${formatTime12h(requestedEndTime)} EST</td></tr>
    <tr><td style="padding:8px 0;color:#888">Schedule</td><td style="padding:8px 0">${recurrenceLabel}</td></tr>
  </table>
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> to see it under Upcoming Lessons.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function lessonProposalDecisionEmailHtml({
  tutorName, parentName, childName, requestedDate, requestedStartTime, requestedEndTime, decision, dashboardUrl,
}: {
  tutorName: string
  parentName: string
  childName: string
  requestedDate: string
  requestedStartTime: string
  requestedEndTime: string
  decision: 'approved' | 'declined'
  dashboardUrl: string
}): string {
  const verb = decision === 'approved' ? 'approved' : 'declined'
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">${parentName} ${verb} your lesson proposal</h2>
  <p style="color:#555;margin-top:0">Hi ${tutorName}, ${parentName} ${verb} the lesson you proposed for ${childName}.</p>
  <table style="border-collapse:collapse;width:100%;margin:20px 0">
    <tr><td style="padding:8px 0;color:#888;width:140px">Date</td><td style="padding:8px 0">${formatDateLong(requestedDate)}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Time</td><td style="padding:8px 0">${formatTime12h(requestedStartTime)} – ${formatTime12h(requestedEndTime)} EST</td></tr>
  </table>
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> for details.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function lessonTimeChangedEmailHtml({
  parentName, tutorName, childName, oldDate, oldStartTime, oldEndTime, newDate, newStartTime, newEndTime, dashboardUrl,
}: {
  parentName: string
  tutorName: string
  childName: string
  oldDate: string
  oldStartTime: string
  oldEndTime: string
  newDate: string
  newStartTime: string
  newEndTime: string
  dashboardUrl: string
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">Your lesson time changed</h2>
  <p style="color:#555;margin-top:0">Hi ${parentName}, ${tutorName} updated the time for ${childName}'s lesson.</p>
  <table style="border-collapse:collapse;width:100%;margin:20px 0">
    <tr><td style="padding:8px 0;color:#888;width:140px">Was</td><td style="padding:8px 0;color:#999;text-decoration:line-through">${formatDateLong(oldDate)}, ${formatTime12h(oldStartTime)} – ${formatTime12h(oldEndTime)} EST</td></tr>
    <tr><td style="padding:8px 0;color:#888">Now</td><td style="padding:8px 0">${formatDateLong(newDate)}, ${formatTime12h(newStartTime)} – ${formatTime12h(newEndTime)} EST</td></tr>
  </table>
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> to view the details.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function addStudentRequestEmailHtml({
  parentName, tutorName, childName, proposedLessonDate, proposedLessonStartTime, proposedLessonEndTime,
  recurrenceLabel, dashboardUrl,
}: {
  parentName: string
  tutorName: string
  childName: string
  proposedLessonDate: string
  proposedLessonStartTime: string
  proposedLessonEndTime: string
  recurrenceLabel?: string
  dashboardUrl: string
}): string {
  const proposedLessonBlock = proposedLessonDate ? `
  <table style="border-collapse:collapse;width:100%;margin:20px 0">
    <tr><td style="padding:8px 0;color:#888;width:140px">Next lesson</td><td style="padding:8px 0">${formatDateLong(proposedLessonDate)}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Time</td><td style="padding:8px 0">${formatTime12h(proposedLessonStartTime)} – ${formatTime12h(proposedLessonEndTime)} EST</td></tr>
    ${recurrenceLabel && recurrenceLabel !== 'One-time lesson' ? `<tr><td style="padding:8px 0;color:#888">Schedule</td><td style="padding:8px 0">${recurrenceLabel}</td></tr>` : ''}
  </table>` : ''
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">${tutorName} added ${childName} as a student</h2>
  <p style="color:#555;margin-top:0">
    Hi ${parentName}, ${tutorName} has set up ${childName} as an ongoing student, so they can schedule future lessons directly — no action needed from you.
  </p>${proposedLessonBlock}
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> to see the details.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function studentRequestDecisionEmailHtml({
  tutorName, parentName, childName, decision, proposedLessonScheduled, dashboardUrl,
}: {
  tutorName: string
  parentName: string
  childName: string
  decision: 'approved' | 'rejected'
  proposedLessonScheduled: boolean
  dashboardUrl: string
}): string {
  const body = decision === 'approved'
    ? `${parentName} approved ${childName} as your ongoing student.${proposedLessonScheduled ? ' The next lesson you proposed is confirmed.' : ''}`
    : `${parentName} declined adding ${childName} as an ongoing student.`
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">${decision === 'approved' ? 'Student request approved' : 'Student request declined'}</h2>
  <p style="color:#555;margin-top:0">Hi ${tutorName}, ${body}</p>
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> for details.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function lessonCompletedEmailHtml({
  parentName, tutorName, childName, requestedDate, reviewUrl,
}: {
  parentName: string
  tutorName: string
  childName: string
  requestedDate: string
  reviewUrl: string
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">How was the lesson?</h2>
  <p style="color:#555;margin-top:0">
    Hi ${parentName}, ${tutorName}'s lesson with ${childName} on ${formatDateLong(requestedDate)} is marked complete.
  </p>
  <p style="margin-top:0">
    <a href="${reviewUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px">
      Leave a review
    </a>
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function lessonConfirmedEmailHtml({
  parentName, tutorName, childName, requestedDate, requestedStartTime, requestedEndTime, dashboardUrl,
}: {
  parentName: string
  tutorName: string
  childName: string
  requestedDate: string
  requestedStartTime: string
  requestedEndTime: string
  dashboardUrl: string
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">Your lesson is confirmed</h2>
  <p style="color:#555;margin-top:0">Hi ${parentName}, ${tutorName} accepted your lesson request for ${childName} — it's officially on the schedule.</p>
  <table style="border-collapse:collapse;width:100%;margin:20px 0">
    <tr><td style="padding:8px 0;color:#888;width:140px">Date</td><td style="padding:8px 0">${formatDateLong(requestedDate)}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Time</td><td style="padding:8px 0">${formatTime12h(requestedStartTime)} – ${formatTime12h(requestedEndTime)} EST</td></tr>
  </table>
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> to see it under Upcoming Lessons.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function lessonTimeProposedEmailHtml({
  recipientName, proposerName, childName, oldDate, oldStartTime, oldEndTime,
  proposedDate, proposedStartTime, proposedEndTime, dashboardUrl,
}: {
  recipientName: string
  proposerName: string
  childName: string
  oldDate: string
  oldStartTime: string
  oldEndTime: string
  proposedDate: string
  proposedStartTime: string
  proposedEndTime: string
  dashboardUrl: string
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">${proposerName} suggested a new lesson time</h2>
  <p style="color:#555;margin-top:0">
    Hi ${recipientName}, ${proposerName} suggested moving ${childName}'s lesson. This won't take effect until you approve it —
    consider emailing ${proposerName} directly to coordinate first.
  </p>
  <table style="border-collapse:collapse;width:100%;margin:20px 0">
    <tr><td style="padding:8px 0;color:#888;width:140px">Currently</td><td style="padding:8px 0;color:#999;text-decoration:line-through">${formatDateLong(oldDate)}, ${formatTime12h(oldStartTime)} – ${formatTime12h(oldEndTime)} EST</td></tr>
    <tr><td style="padding:8px 0;color:#888">Suggested</td><td style="padding:8px 0">${formatDateLong(proposedDate)}, ${formatTime12h(proposedStartTime)} – ${formatTime12h(proposedEndTime)} EST</td></tr>
  </table>
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> to approve or decline.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function lessonTimeProposalDecisionEmailHtml({
  recipientName, responderName, childName, decision, dashboardUrl,
}: {
  recipientName: string
  responderName: string
  childName: string
  decision: 'approved' | 'declined'
  dashboardUrl: string
}): string {
  const body = decision === 'approved'
    ? `${responderName} approved your suggested new time for ${childName}'s lesson — it's updated.`
    : `${responderName} declined your suggested new time for ${childName}'s lesson — it stays as it was.`
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">${decision === 'approved' ? 'Time change approved' : 'Time change declined'}</h2>
  <p style="color:#555;margin-top:0">Hi ${recipientName}, ${body}</p>
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> for details.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function lessonTimeOverriddenEmailHtml({
  parentName, tutorName, childName, oldDate, oldStartTime, oldEndTime,
  newDate, newStartTime, newEndTime, dashboardUrl,
}: {
  parentName: string
  tutorName: string
  childName: string
  oldDate: string
  oldStartTime: string
  oldEndTime: string
  newDate: string
  newStartTime: string
  newEndTime: string
  dashboardUrl: string
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">Your lesson time changed</h2>
  <p style="color:#555;margin-top:0">Hi ${parentName}, ${tutorName} changed the time for ${childName}'s lesson.</p>
  <table style="border-collapse:collapse;width:100%;margin:20px 0">
    <tr><td style="padding:8px 0;color:#888;width:140px">Was</td><td style="padding:8px 0;color:#999;text-decoration:line-through">${formatDateLong(oldDate)}, ${formatTime12h(oldStartTime)} – ${formatTime12h(oldEndTime)} EST</td></tr>
    <tr><td style="padding:8px 0;color:#888">Now</td><td style="padding:8px 0">${formatDateLong(newDate)}, ${formatTime12h(newStartTime)} – ${formatTime12h(newEndTime)} EST</td></tr>
  </table>
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> to view the details.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}

export function tutorRelationshipEndedEmailHtml({
  tutorName, parentName, childName, dashboardUrl,
}: {
  tutorName: string
  parentName: string
  childName: string
  dashboardUrl: string
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:4px">${parentName} ended your lessons with ${childName}</h2>
  <p style="color:#555;margin-top:0">
    Hi ${tutorName}, ${parentName} removed you as ${childName}'s tutor. Any future lessons between you have been cancelled.
  </p>
  <p style="margin-top:0"><a href="${dashboardUrl}">Open your dashboard</a> for details.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Tune Up Together · tutoio.app@gmail.com</p>
</div>`
}
