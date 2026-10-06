import type { MoveRequestData } from "../domain/request-data.js";
import type { CommunityPolicyConfig } from "./config.js";

export type PolicyResult =
  | "INCOMPLETE"
  | "PASS"
  | "WARNING"
  | "FAIL";

type PolicyCheck = {
  name: string;
  result: PolicyResult;
  message: string;
};

type EvaluatePolicyInput = {
  type: "MOVE_IN" | "MOVE_OUT";
  requestData: MoveRequestData;
  policy: CommunityPolicyConfig;
  now?: Date;
};

export function evaluatePolicy({
  type,
  requestData,
  policy,
  now = new Date(),
}: EvaluatePolicyInput) {
  const checks: PolicyCheck[] = [];

  // Required date
  if (!requestData.moveDate) {
    checks.push({
      name: "MOVE_DATE",
      result: "INCOMPLETE",
      message: "Move date is required",
    });
  }

  // Required time
  if (!requestData.preferredTime) {
    checks.push({
      name: "MOVE_TIME",
      result: "INCOMPLETE",
      message: "Preferred move time is required",
    });
  }

  // Notice period
  if (requestData.moveDate) {
    const moveDate = new Date(
      `${requestData.moveDate}T00:00:00`,
    );

    if (Number.isNaN(moveDate.getTime())) {
      checks.push({
        name: "MOVE_DATE",
        result: "FAIL",
        message: "Move date is invalid",
      });
    } else {
      const hoursUntilMove =
        (moveDate.getTime() - now.getTime()) /
        (1000 * 60 * 60);

      if (hoursUntilMove < policy.noticeHours) {
        checks.push({
          name: "NOTICE_PERIOD",
          result: "FAIL",
          message: `Move requires at least ${policy.noticeHours} hours notice`,
        });
      } else {
        checks.push({
          name: "NOTICE_PERIOD",
          result: "PASS",
          message: "Notice period requirement satisfied",
        });
      }
    }
  }

  // Moving hours
  if (requestData.preferredTime) {
    const { start, end } = policy.movingHours;

    if (
      requestData.preferredTime < start ||
      requestData.preferredTime > end
    ) {
      checks.push({
        name: "MOVING_HOURS",
        result: "FAIL",
        message: `Moving is allowed between ${start} and ${end}`,
      });
    } else {
      checks.push({
        name: "MOVING_HOURS",
        result: "PASS",
        message: "Preferred time is within allowed moving hours",
      });
    }
  }

  // Required documents
  const requiredDocuments =
    policy.requiredDocuments[type] ?? [];

  const providedDocuments =
    requestData.documents ?? [];

  const missingDocuments = requiredDocuments.filter(
    (document) => !providedDocuments.includes(document),
  );

  if (missingDocuments.length > 0) {
    checks.push({
      name: "REQUIRED_DOCUMENTS",
      result: "INCOMPLETE",
      message: `Missing documents: ${missingDocuments.join(", ")}`,
    });
  } else {
    checks.push({
      name: "REQUIRED_DOCUMENTS",
      result: "PASS",
      message: "Required documents provided",
    });
  }

  if (policy.elevatorBookingRequired) {
    checks.push({
      name: "ELEVATOR_BOOKING",
      result: requestData.elevatorBookingRequested ? "PASS" : "INCOMPLETE",
      message: requestData.elevatorBookingRequested
        ? "Elevator booking requested"
        : "Elevator booking is required",
    });
  }

  // Overall result
  let result: PolicyResult = "PASS";

  if (checks.some((check) => check.result === "FAIL")) {
    result = "FAIL";
  } else if (
    checks.some((check) => check.result === "INCOMPLETE")
  ) {
    result = "INCOMPLETE";
  } else if (
    checks.some((check) => check.result === "WARNING")
  ) {
    result = "WARNING";
  }

  return {
    result,
    checks,
  };
}
