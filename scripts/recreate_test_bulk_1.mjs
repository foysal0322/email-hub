import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Recreating 'Test bulk 1' Campaign ===");

  // Check if Test bulk 1 already exists
  const existing = await prisma.campaign.findFirst({
    where: { name: "Test bulk 1" },
  });

  if (existing) {
    console.log(`Campaign 'Test bulk 1' already exists with ID: ${existing.id}`);
    return;
  }

  // Get Test bulk 2 for htmlContent reference
  const testBulk2 = await prisma.campaign.findFirst({
    where: { name: "Test bulk 2" },
  });

  if (!testBulk2) {
    throw new Error("Reference campaign 'Test bulk 2' not found.");
  }

  // Load the first 500 contacts
  const jsonPath = "C:/Users/Foysal/OneDrive/Desktop/get-nsu-email/active_student_contacts.json";
  const allStudents = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const first500 = allStudents.slice(0, 500);
  const emails500 = new Set(first500.map((s) => s.email.toLowerCase().trim()));

  const contactsInDb = await prisma.contact.findMany({
    where: {
      normalizedEmail: {
        in: Array.from(emails500),
      },
    },
  });

  console.log(`Found ${contactsInDb.length} matched student contacts in database.`);

  const createdAt = new Date("2026-10-18T05:14:00.000Z");
  const startedAt = new Date("2026-10-18T05:15:00.000Z");
  const completedAt = new Date("2026-10-18T05:54:00.000Z");

  // Create Campaign
  const campaign = await prisma.campaign.create({
    data: {
      name: "Test bulk 1",
      subject: testBulk2.subject || "NSUer পড়াবেন?",
      fromName: testBulk2.fromName || "nsuOne",
      fromEmail: testBulk2.fromEmail || "hello@nsuone.com",
      replyTo: testBulk2.replyTo || null,
      htmlContent: testBulk2.htmlContent,
      plainTextContent: testBulk2.plainTextContent || null,
      status: "completed",
      sendRate: 10,
      trackOpens: true,
      trackClicks: true,
      totalRecipients: contactsInDb.length,
      eligibleRecipients: contactsInDb.length,
      sentCount: contactsInDb.length,
      deliveredCount: contactsInDb.length,
      createdAt,
      startedAt,
      completedAt,
    },
  });

  console.log(`Campaign 'Test bulk 1' created with ID: ${campaign.id}`);

  // Create CampaignRecipient records
  const recipientsData = contactsInDb.map((contact) => ({
    campaignId: campaign.id,
    contactId: contact.id,
    email: contact.email,
    name: contact.fullName,
    customAttributes: contact.customAttributes,
    status: "accepted",
    sentAt: startedAt,
    createdAt: startedAt,
  }));

  // Batch insert recipients
  const BATCH_SIZE = 100;
  for (let i = 0; i < recipientsData.length; i += BATCH_SIZE) {
    const batch = recipientsData.slice(i, i + BATCH_SIZE);
    await prisma.campaignRecipient.createMany({
      data: batch,
    });
  }

  // Create EmailMessage records
  const messagesData = contactsInDb.map((contact) => ({
    campaignId: campaign.id,
    contactId: contact.id,
    recipientEmail: contact.email,
    fromEmail: campaign.fromEmail,
    subject: campaign.subject,
    status: "accepted",
    sentAt: startedAt,
    createdAt: startedAt,
  }));

  for (let i = 0; i < messagesData.length; i += BATCH_SIZE) {
    const batch = messagesData.slice(i, i + BATCH_SIZE);
    await prisma.emailMessage.createMany({
      data: batch,
    });
  }

  console.log(`Successfully created ${recipientsData.length} recipients and messages for 'Test bulk 1'.`);
  console.log("=== Campaign Restoration Complete ===");
}

main()
  .catch((e) => {
    console.error("Error creating campaign:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
