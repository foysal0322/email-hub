import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Starting Merge of Student Contacts 1 to 500 ===");

  const jsonPath = "C:/Users/Foysal/OneDrive/Desktop/get-nsu-email/active_student_contacts.json";
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File not found: ${jsonPath}`);
  }

  const rawData = fs.readFileSync(jsonPath, "utf8");
  const allStudents = JSON.parse(rawData);
  console.log(`Total students in source file: ${allStudents.length}`);

  const targetStudents = allStudents.slice(0, 500);
  console.log(`Processing slice: ${targetStudents.length} contacts (Index 0 to 499)`);
  console.log(`First student: ${targetStudents[0].name} (${targetStudents[0].email})`);
  console.log(`Last student: ${targetStudents[499].name} (${targetStudents[499].email})`);

  // Target list: Marketing & Growth
  const targetList = await prisma.contactList.findUnique({
    where: { id: "list_marketing" },
  });

  if (!targetList) {
    throw new Error("Target list 'list_marketing' not found in database.");
  }
  console.log(`Target List: ${targetList.name} (Current count: ${targetList.contactCount})`);

  // Create an ImportJob record for tracking
  const importJob = await prisma.importJob.create({
    data: {
      filename: "active_student_contacts_1_to_500.json",
      fileType: "json",
      totalRows: targetStudents.length,
      status: "processing",
    },
  });

  let createdCount = 0;
  let updatedCount = 0;
  let duplicateCount = 0;
  let memberCount = 0;

  for (let i = 0; i < targetStudents.length; i++) {
    const student = targetStudents[i];
    const email = student.email.trim();
    const normalizedEmail = email.toLowerCase();
    const fullName = (student.name || "").trim();
    const customAttributes = JSON.stringify({ id: student.id });

    // Check if contact already exists
    const existing = await prisma.contact.findUnique({
      where: { normalizedEmail },
    });

    let contactId;

    if (existing) {
      duplicateCount++;
      contactId = existing.id;
      // Update custom attributes or name if missing
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          fullName: fullName || existing.fullName,
          customAttributes: customAttributes || existing.customAttributes,
          updatedAt: new Date(),
        },
      });
      updatedCount++;
    } else {
      const created = await prisma.contact.create({
        data: {
          email,
          normalizedEmail,
          fullName,
          customAttributes,
          status: "subscribed",
          validationStatus: "valid_format",
          source: "import",
        },
      });
      contactId = created.id;
      createdCount++;
    }

    // Attach to list_marketing
    try {
      await prisma.contactListMember.upsert({
        where: {
          contactId_listId: {
            contactId,
            listId: targetList.id,
          },
        },
        create: {
          contactId,
          listId: targetList.id,
        },
        update: {},
      });
      memberCount++;
    } catch (err) {
      console.warn(`Could not add membership for ${email}:`, err.message);
    }

    if ((i + 1) % 100 === 0 || i === targetStudents.length - 1) {
      console.log(`Progress: ${i + 1}/${targetStudents.length} contacts processed...`);
    }
  }

  // Update list count
  const updatedListCount = await prisma.contactListMember.count({
    where: { listId: targetList.id },
  });

  await prisma.contactList.update({
    where: { id: targetList.id },
    data: { contactCount: updatedListCount },
  });

  // Finalize import job
  await prisma.importJob.update({
    where: { id: importJob.id },
    data: {
      importedRows: createdCount + updatedCount,
      duplicateCount,
      failedRows: 0,
      status: "completed",
    },
  });

  const totalContactsNow = await prisma.contact.count();

  console.log("\n=== Merge Completed Successfully! ===");
  console.log(`Newly created contacts: ${createdCount}`);
  console.log(`Updated contacts: ${updatedCount}`);
  console.log(`Duplicate matches: ${duplicateCount}`);
  console.log(`Total contacts in database: ${totalContactsNow}`);
  console.log(`Total members in '${targetList.name}': ${updatedListCount}`);
}

main()
  .catch((e) => {
    console.error("Merge error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
