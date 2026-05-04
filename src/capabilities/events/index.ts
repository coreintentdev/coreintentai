import { Orchestrator } from "../../orchestrator/index.js";
import {
  EventCalendarSchema,
  EventImpactAnalysisSchema,
  type EventCalendar,
  type EventImpactAnalysis,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  EVENT_SYSTEM_PROMPT,
  buildEventScanPrompt,
  buildEventImpactPrompt,
  buildEventStrategyPrompt,
} from "./prompts.js";

export class EventIntelligence {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async scan(params: {
    startDate: string;
    endDate: string;
    tickers?: string[];
    sectors?: string[];
    includeEconomic?: boolean;
    includeFed?: boolean;
    includeEarnings?: boolean;
  }): Promise<EventCalendar> {
    const response = await this.orchestrator.execute({
      intent: "research",
      systemPrompt: EVENT_SYSTEM_PROMPT,
      prompt: buildEventScanPrompt(params),
    });

    return parseJsonResponse(response.content, EventCalendarSchema);
  }

  async impactAnalysis(params: {
    event: string;
    category: string;
    actual?: string;
    expected?: string;
    marketData?: string;
    sectorData?: string;
  }): Promise<EventImpactAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: EVENT_SYSTEM_PROMPT,
      prompt: buildEventImpactPrompt(params),
    });

    return parseJsonResponse(response.content, EventImpactAnalysisSchema);
  }

  async eventStrategy(params: {
    events: Array<{ name: string; date: string; category: string }>;
    portfolioContext?: string;
    riskTolerance?: string;
  }): Promise<EventCalendar> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: EVENT_SYSTEM_PROMPT,
      prompt: buildEventStrategyPrompt(params),
    });

    return parseJsonResponse(response.content, EventCalendarSchema);
  }

  /**
   * Multi-model event consensus: Perplexity for real-time calendar data,
   * Claude for impact analysis, then synthesize.
   */
  async consensus(params: {
    startDate: string;
    endDate: string;
    tickers?: string[];
  }): Promise<{ calendars: EventCalendar[]; agreement: number }> {
    const prompt = buildEventScanPrompt(params);

    const responses = await this.orchestrator.consensus(
      {
        intent: "research",
        systemPrompt: EVENT_SYSTEM_PROMPT,
        prompt,
      },
      ["perplexity", "claude"]
    );

    const calendars = responses.map((r) =>
      parseJsonResponse(r.content, EventCalendarSchema)
    );

    const agreement = this.calculateAgreement(calendars);

    return { calendars, agreement };
  }

  /**
   * Full event intelligence pipeline: scan → filter high-impact →
   * deep-dive each with impact analysis.
   */
  async fullBriefing(params: {
    startDate: string;
    endDate: string;
    tickers?: string[];
  }): Promise<{
    calendar: EventCalendar;
    impactAnalyses: EventImpactAnalysis[];
  }> {
    const calendar = await this.scan(params);

    const highImpact = calendar.events.filter(
      (e) => e.expectedImpact === "critical" || e.expectedImpact === "high"
    );

    const impactAnalyses: EventImpactAnalysis[] = [];
    for (const event of highImpact) {
      const analysis = await this.impactAnalysis({
        event: event.name,
        category: event.category,
      });
      impactAnalyses.push(analysis);
    }

    return { calendar, impactAnalyses };
  }

  private calculateAgreement(calendars: EventCalendar[]): number {
    if (calendars.length < 2) return 1;

    const densities = calendars.map((c) => c.riskDensity);
    const densityMatch = densities.every((d) => d === densities[0]) ? 1 : 0;

    const biases = calendars.map((c) => c.tradingBias.direction);
    const biasMatch = biases.every((b) => b === biases[0]) ? 1 : 0;

    const eventCounts = calendars.map((c) => c.events.length);
    const countRange = Math.max(...eventCounts) - Math.min(...eventCounts);
    const avgCount =
      eventCounts.reduce((a, b) => a + b, 0) / eventCounts.length;
    const countAgreement = avgCount > 0 ? Math.max(0, 1 - countRange / avgCount) : 1;

    return densityMatch * 0.3 + biasMatch * 0.4 + countAgreement * 0.3;
  }
}

export { EVENT_SYSTEM_PROMPT } from "./prompts.js";
