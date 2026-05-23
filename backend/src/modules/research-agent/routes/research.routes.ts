import { Router } from "express";

import { handleResearchRequest } from "../controllers/research.controller";

const researchAgentRouter = Router();

researchAgentRouter.post("/research", handleResearchRequest);

export default researchAgentRouter;