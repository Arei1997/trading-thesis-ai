import { Tool } from '@anthropic-ai/sdk/resources';

export const EVALUATOR_SYSTEM_PROMPT =
  'You are a financial analysis assistant specialising in evaluating how news events impact active trading positions. You are precise, concise, and non-speculative. You always return valid JSON.';

export const buildEvaluatorUserPrompt = (params: {
  thesisText: string;
  assetName: string;
  direction: string;
  headline: string;
  body?: string;
}): string => {
  const newsBody = params.body
    ? params.body.slice(0, 2000)
    : 'No body provided.';

  return `Evaluate the following news against this trading thesis.

THESIS: ${params.thesisText}
ASSET: ${params.assetName}
DIRECTION: ${params.direction}

NEWS HEADLINE: ${params.headline}
NEWS BODY: ${newsBody}`;
};

export const EVALUATOR_TOOL: Tool = {
  name: 'submit_evaluation',
  description: 'Submit a structured evaluation of how this news impacts the trading thesis.',
  input_schema: {
    type: 'object',
    properties: {
      impactDirection: {
        type: 'string',
        enum: ['SUPPORTS', 'WEAKENS', 'NEUTRAL'],
        description: 'Whether the news supports, weakens, or is neutral to the thesis.',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score from 0 to 100.',
      },
      reasoning: {
        type: 'string',
        description: '2-3 sentence explanation of the impact.',
      },
      suggestedAction: {
        type: 'string',
        enum: ['HOLD', 'REVIEW', 'CONSIDER_CLOSING'],
        description: 'Suggested trader action based on this evaluation.',
      },
      keyRiskFactors: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 3 key risk factors surfaced by this news.',
      },
    },
    required: ['impactDirection', 'confidence', 'reasoning', 'suggestedAction', 'keyRiskFactors'],
  },
};
