import { Router } from "express";
import { BalanceService } from "../services/balance.service.js";
import { requireAuth, requireHouseholdMember } from "../middleware/auth.js";

export const balanceRouter = Router();

balanceRouter.use(requireAuth);

balanceRouter.get(
  "/households/:householdId/balances",
  requireHouseholdMember("householdId"),
  async (req, res, next) => {
    try {
      const data = await BalanceService.getBalances(req.params.householdId as string);
      res.json(data);
    } catch (error) {
      next(error);
    }
  }
);

balanceRouter.get(
  "/households/:householdId/balances/suggestions",
  requireHouseholdMember("householdId"),
  async (req, res, next) => {
    try {
      const data = await BalanceService.getBalances(req.params.householdId as string);
      res.json(data.suggestions);
    } catch (error) {
      next(error);
    }
  }
);
