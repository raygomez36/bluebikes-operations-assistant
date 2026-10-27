import { Router, type IRouter } from "express";
import {
  AskOperationsAgentBody,
  AskOperationsAgentResponse,
  ExtractEventDetailsBody,
  ExtractEventDetailsResponse,
  GetBacktestQueryParams,
  GetBacktestResponse,
  GetOperationsOverviewResponse,
  GetSensitivityQueryParams,
  GetSensitivityResponse,
  GetStaffingPlanQueryParams,
  GetStaffingPlanResponse,
} from "@workspace/api-zod";
import {
  extractStructuredEvents,
  askOperationsAgent,
} from "../lib/operations-agent";
import {
  filterBacktest,
  filterSensitivity,
  filterStaffing,
  getOperationsData,
  getOperationsOverview,
} from "../lib/operations-data";

const router: IRouter = Router();

router.get("/operations/overview", async (_req, res): Promise<void> => {
  const overview = await getOperationsOverview();
  res.json(GetOperationsOverviewResponse.parse(overview));
});

router.get("/operations/staffing", async (req, res): Promise<void> => {
  const query = GetStaffingPlanQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { staffing } = await getOperationsData();
  res.json(
    GetStaffingPlanResponse.parse(filterStaffing(staffing, query.data.city)),
  );
});

router.get("/operations/backtest", async (req, res): Promise<void> => {
  const query = GetBacktestQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { backtest } = await getOperationsData();
  res.json(
    GetBacktestResponse.parse(filterBacktest(backtest, query.data.city)),
  );
});

router.get("/operations/sensitivity", async (req, res): Promise<void> => {
  const query = GetSensitivityQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { sensitivity } = await getOperationsData();
  res.json(
    GetSensitivityResponse.parse(
      filterSensitivity(sensitivity, query.data.city),
    ),
  );
});

router.post("/agent/chat", async (req, res): Promise<void> => {
  const body = AskOperationsAgentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  try {
    const response = await askOperationsAgent(body.data);
    res.json(AskOperationsAgentResponse.parse(response));
  } catch (error) {
    req.log.error(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "Operations agent request failed",
    );
    res.status(502).json({
      error: "The operations assistant is temporarily unavailable. Please try again.",
    });
  }
});

router.post("/operations/events/extract", async (req, res): Promise<void> => {
  const body = ExtractEventDetailsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  try {
    const events = await extractStructuredEvents(body.data.sourceText);
    res.json(ExtractEventDetailsResponse.parse(events));
  } catch (error) {
    req.log.error(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "Event text extraction failed",
    );
    res.status(502).json({
      error: "Event text could not be processed right now. Please try again.",
    });
  }
});

export default router;
