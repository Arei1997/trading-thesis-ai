import Anthropic from '@anthropic-ai/sdk';
import { ImpactDirection, SuggestedAction } from '@prisma/client';
import { db } from '../lib/db';
import { sendAlert } from './alertService';
import {
  EVALUATOR_SYSTEM_PROMPT,
  EVALUATOR_TOOL,
  buildEvaluatorUserPrompt,
} from '../prompts/thesis-evaluator-v1';

const client = new Anthropic();

interface EvaluateInput {
  thesisId: string;
  newsHeadline: string;
  newsBody?: string;
}

interface EvaluationResult {
  impactDirection: ImpactDirection;
  confidence: number;
  reasoning: string;
  suggestedAction: SuggestedAction;
  keyRiskFactors: string[];
}

const callLLM = async (
  thesisText: string,
  assetName: string,
  direction: string,
  headline: string,
  body?: string,
): Promise<EvaluationResult> => {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: EVALUATOR_SYSTEM_PROMPT,
    tools: [EVALUATOR_TOOL],
    tool_choice: { type: 'any' },
    messages: [
      {
        role: 'user',
        content: buildEvaluatorUserPrompt({ thesisText, assetName, direction, headline, body }),
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('LLM did not return a tool_use block');
  }

  return toolUse.input as EvaluationResult;
};

const evaluate = async (input: EvaluateInput) => {
  const thesis = await db.thesis.findUnique({
    where: { id: input.thesisId },
    include: { user: true },
  });
  if (!thesis) return null;

  const result = await callLLM(
    thesis.thesisText,
    thesis.assetName,
    thesis.direction,
    input.newsHeadline,
    input.newsBody,
  );

  const evaluation = await db.evaluation.create({
    data: {
      thesisId: input.thesisId,
      newsHeadline: input.newsHeadline,
      newsBody: input.newsBody,
      impactDirection: result.impactDirection,
      confidence: result.confidence,
      reasoning: result.reasoning,
      suggestedAction: result.suggestedAction,
      keyRiskFactors: result.keyRiskFactors,
    },
  });

  if (result.confidence >= thesis.alertThreshold) {
    await sendAlert({ ...evaluation, thesis });
  }

  return evaluation;
};

const getByThesis = (thesisId: string) => {
  return db.evaluation.findMany({
    where: { thesisId },
    orderBy: { createdAt: 'desc' },
  });
};

export const evaluationService = { evaluate, getByThesis };
