import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { db, EVENTS_TABLE, REGISTRATIONS_TABLE } from "../shared/db.mjs";
import { ok, badRequest, notFound, conflict, serverError, cors } from "../shared/response.mjs";
import { newId, registrationNumber } from "../shared/ids.mjs";
import { audit } from "../shared/auth.mjs";

const sns = new SNSClient({});

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  const { eventId } = event.pathParameters ?? {};
  if (!eventId) return badRequest("eventId is required");

  let body;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return badRequest("Invalid JSON");
  }

  const { fullName, organisation, email, phone, position } = body;
  if (!fullName || fullName.trim().length < 2) return badRequest("fullName is required");
  if (!organisation || organisation.trim().length < 2) return badRequest("organisation is required");
  if (!email || !validateEmail(email.trim())) return badRequest("Valid email is required");

  // Check event exists and registration is open
  const eventResult = await db.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { eventId } }));
  if (!eventResult.Item) return notFound("Event not found");
  if (!eventResult.Item.registrationOpen) return badRequest("Registration is currently closed");

  // Check for duplicate email in this event
  const existing = await db.send(new QueryCommand({
    TableName: REGISTRATIONS_TABLE,
    IndexName: "email-eventId-index",
    KeyConditionExpression: "email = :email AND eventId = :eventId",
    ExpressionAttributeValues: { ":email": email.toLowerCase().trim(), ":eventId": eventId },
    Limit: 1,
  }));
  if ((existing.Items ?? []).length > 0) return conflict("This email is already registered for this event");

  const regNumber = registrationNumber(
    eventResult.Item.name.replace(/\s+/g, "").slice(0, 6).toUpperCase()
  );

  const item = {
    registrationId: newId(),
    eventId,
    registrationNumber: regNumber,
    fullName: fullName.trim(),
    organisation: organisation.trim(),
    email: email.toLowerCase().trim(),
    phone: phone?.trim() ?? null,
    position: position?.trim() ?? null,
    registrationType: "online",
    checkedInAt: null,
    checkedInBy: null,
    badgePrintedAt: null,
    badgePrintCount: 0,
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await db.send(new PutCommand({ TableName: REGISTRATIONS_TABLE, Item: item }));
    await audit("participant.registered", {
      entity: "participant",
      entityId: item.registrationId,
      meta: { name: item.fullName, reg: item.registrationNumber, eventId },
    });

    // SNS confirmation email (optional — only fires if SNS_TOPIC_ARN is set)
    if (process.env.SNS_TOPIC_ARN) {
      await sns.send(new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Subject: `Registration confirmed — ${eventResult.Item.name}`,
        Message: JSON.stringify({
          type: "registration_confirmation",
          to: item.email,
          fullName: item.fullName,
          registrationNumber: item.registrationNumber,
          eventName: eventResult.Item.name,
          eventDate: eventResult.Item.date,
          venue: eventResult.Item.venue,
        }),
      }));
    }

    return ok({ registrationNumber: item.registrationNumber, registrationId: item.registrationId });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
