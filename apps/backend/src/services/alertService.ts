import { Resend } from 'resend';
import { Evaluation, Thesis, User } from '@prisma/client';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Trading Thesis AI <onboarding@resend.dev>';

type EvaluationWithThesis = Evaluation & {
  thesis: Thesis & { user: User };
};

const impactColour: Record<string, string> = {
  SUPPORTS: '#22c55e',
  WEAKENS: '#ef4444',
  NEUTRAL: '#6b7280',
};

const actionLabel: Record<string, string> = {
  HOLD: 'Hold position',
  REVIEW: 'Review position',
  CONSIDER_CLOSING: 'Consider closing',
};

const buildHtml = (ev: EvaluationWithThesis): string => {
  const colour = impactColour[ev.impactDirection];
  const action = actionLabel[ev.suggestedAction];
  const risks = ev.keyRiskFactors.map((r) => `<li>${r}</li>`).join('');

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 4px">Trading Thesis AI — Alert</h2>
      <p style="color:#6b7280;margin:0 0 24px;font-size:14px">${new Date(ev.createdAt).toLocaleString()}</p>

      <div style="border-left:4px solid ${colour};padding:12px 16px;background:#f9fafb;border-radius:4px;margin-bottom:24px">
        <p style="margin:0;font-size:18px;font-weight:700;color:${colour}">${ev.impactDirection}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#374151">
          <strong>${ev.thesis.assetName}</strong> · ${ev.thesis.direction} · Confidence: <strong>${ev.confidence}%</strong>
        </p>
      </div>

      <p style="font-size:14px;color:#374151"><strong>News:</strong> ${ev.newsHeadline}</p>
      <p style="font-size:14px;color:#374151"><strong>Reasoning:</strong> ${ev.reasoning}</p>

      ${risks ? `<p style="font-size:14px;color:#374151"><strong>Key risk factors:</strong></p><ul style="font-size:14px;color:#374151">${risks}</ul>` : ''}

      <div style="margin-top:24px;padding:12px 16px;background:#f3f4f6;border-radius:4px">
        <p style="margin:0;font-size:14px;font-weight:700">Suggested action: ${action}</p>
      </div>
    </div>
  `;
};

export const sendAlert = async (ev: EvaluationWithThesis): Promise<void> => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[alert] RESEND_API_KEY not set — skipping email');
    return;
  }

  const subject = `[${ev.impactDirection}] ${ev.thesis.assetName} — ${ev.confidence}% confidence`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: ev.thesis.user.email,
    subject,
    html: buildHtml(ev),
  });

  if (error) {
    console.error('[alert] email send failed:', error.message);
    return;
  }

  console.log(`[alert] sent to ${ev.thesis.user.email} — ${subject}`);
};
