import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, REGISTRATIONS_TABLE } from "./shared/db.mjs";
import { audit } from "./shared/auth.mjs";

const ses = new SESClient({});

export async function handler(event) {
  for (const record of event.Records) {
    let payload;
    try {
      payload = JSON.parse(record.body);
    } catch (e) {
      console.error("Failed to parse SQS message", record.body, e);
      continue;
    }

    const { registrationId, email, fullName, registrationNumber, eventName, eventDate, venue } = payload;

    const dateStr = eventDate
      ? new Date(eventDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : "To be announced";

    // Send confirmation email
    if (process.env.SES_SOURCE_EMAIL) {
      await ses.send(new SendEmailCommand({
        Source: process.env.SES_SOURCE_EMAIL,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: `Registration confirmed — ${eventName}` },
          Body: {
            Text: {
              Data: [
                `Hi ${fullName},`,
                ``,
                `Your registration for ${eventName} is confirmed.`,
                ``,
                `Registration number: ${registrationNumber}`,
                `Date: ${dateStr}`,
                `Venue: ${venue ?? "To be announced"}`,
                ``,
                `Keep your registration number handy — show it at reception to collect your badge.`,
                ``,
                `See you there!`,
              ].join("\n"),
            },
          },
        },
      }));
    }

    const now = new Date().toISOString();

    // Update registration with emailSentAt
    await db.send(new UpdateCommand({
      TableName: REGISTRATIONS_TABLE,
      Key: { registrationId },
      UpdateExpression: "SET emailSentAt = :t, updatedAt = :t",
      ExpressionAttributeValues: { ":t": now },
    }));

    // Audit log
    await audit("ticket.processed", {
      entity: "registration",
      entityId: registrationId,
      meta: { registrationNumber, eventName, email },
    });
  }
}
