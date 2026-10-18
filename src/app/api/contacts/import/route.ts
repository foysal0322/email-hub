import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import Papa from "papaparse";
import { normalizeEmail, validateEmail } from "@/lib/validation";

interface ImportMapping {
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  organization?: string;
  jobTitle?: string;
  phone?: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      content,
      fileType = "csv",
      filename = "contacts_import",
      duplicateStrategy = "skip", // "skip" | "overwrite"
      customMapping = {},
      listId,
    } = body;

    if (!content) {
      return NextResponse.json({ error: "No content provided for import" }, { status: 400 });
    }

    let records: Record<string, unknown>[] = [];

    if (fileType === "json") {
      try {
        const parsed = typeof content === "string" ? JSON.parse(content) : content;
        records = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
      }
    } else {
      // CSV parse using PapaParse
      const parseResult = Papa.parse<Record<string, unknown>>(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
      });

      if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
        return NextResponse.json(
          { error: "Failed to parse CSV file", details: parseResult.errors },
          { status: 400 }
        );
      }
      records = parseResult.data;
    }

    // Create persistent ImportJob
    const importJob = await prisma.importJob.create({
      data: {
        filename,
        fileType,
        totalRows: records.length,
        status: "processing",
      },
    });

    let importedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    const errorsToInsert: Array<{
      importJobId: string;
      rowNumber: number;
      rawRecord: string;
      errorMessage: string;
    }> = [];

    for (let index = 0; index < records.length; index++) {
      const rowNumber = index + 1;
      const row = records[index];

      // Auto-detect or use mapping
      const emailRaw = String(
        row[customMapping.email || ""] ||
          row["email"] ||
          row["mail"] ||
          row["email_address"] ||
          row["e-mail"] ||
          ""
      ).trim();

      const normalized = normalizeEmail(emailRaw);

      if (!normalized) {
        failedCount++;
        errorsToInsert.push({
          importJobId: importJob.id,
          rowNumber,
          rawRecord: JSON.stringify(row),
          errorMessage: "Missing or empty email address",
        });
        continue;
      }

      // Syntax check
      const validation = await validateEmail(normalized, { checkDns: false, useCache: true });
      if (validation.status === "invalid") {
        failedCount++;
        errorsToInsert.push({
          importJobId: importJob.id,
          rowNumber,
          rawRecord: JSON.stringify(row),
          errorMessage: `Invalid email syntax: ${validation.details}`,
        });
        continue;
      }

      // Determine fields
      const name = String(
        row[customMapping.name || ""] ||
          row["name"] ||
          row["fullname"] ||
          row["full_name"] ||
          ""
      ).trim();

      const firstName = String(
        row[customMapping.firstName || ""] ||
          row["first_name"] ||
          row["firstname"] ||
          ""
      ).trim();

      const lastName = String(
        row[customMapping.lastName || ""] ||
          row["last_name"] ||
          row["lastname"] ||
          ""
      ).trim();

      const department = String(
        row[customMapping.department || ""] ||
          row["department"] ||
          row["dept_name"] ||
          row["dept"] ||
          ""
      ).trim();

      const organization = String(
        row[customMapping.organization || ""] ||
          row["organization"] ||
          row["company"] ||
          row["org"] ||
          ""
      ).trim();

      const jobTitle = String(
        row[customMapping.jobTitle || ""] ||
          row["designation"] ||
          row["job_title"] ||
          row["title"] ||
          ""
      ).trim();

      const phone = String(
        row[customMapping.phone || ""] ||
          row["phone"] ||
          row["phone_number"] ||
          row["mobile"] ||
          ""
      ).trim();

      // Extract custom attributes (anything not in standard mapping)
      const standardKeys = new Set([
        "email",
        "mail",
        "email_address",
        "e-mail",
        "name",
        "fullname",
        "full_name",
        "first_name",
        "firstname",
        "last_name",
        "lastname",
        "department",
        "dept_name",
        "dept",
        "organization",
        "company",
        "org",
        "designation",
        "job_title",
        "title",
        "phone",
        "phone_number",
        "mobile",
      ]);

      const customAttrs: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(row)) {
        if (!standardKeys.has(key.toLowerCase()) && val !== undefined && val !== null && val !== "") {
          customAttrs[key] = val;
        }
      }
      // Also store dept_name and designation explicitly if they were present
      if (department) customAttrs["dept_name"] = department;
      if (jobTitle) customAttrs["designation"] = jobTitle;

      // Duplicate check
      const existing = await prisma.contact.findUnique({
        where: { normalizedEmail: normalized },
      });

      let contactId: string;

      if (existing) {
        duplicateCount++;
        contactId = existing.id;
        if (duplicateStrategy === "overwrite") {
          await prisma.contact.update({
            where: { id: existing.id },
            data: {
              email: emailRaw,
              fullName: name || existing.fullName,
              firstName: firstName || existing.firstName,
              lastName: lastName || existing.lastName,
              department: department || existing.department,
              organization: organization || existing.organization,
              jobTitle: jobTitle || existing.jobTitle,
              phone: phone || existing.phone,
              customAttributes: JSON.stringify(customAttrs),
              updatedAt: new Date(),
            },
          });
          importedCount++;
        }
      } else {
        const created = await prisma.contact.create({
          data: {
            email: emailRaw,
            normalizedEmail: normalized,
            fullName: name || [firstName, lastName].filter(Boolean).join(" ") || null,
            firstName: firstName || null,
            lastName: lastName || null,
            department: department || null,
            organization: organization || null,
            jobTitle: jobTitle || null,
            phone: phone || null,
            customAttributes: Object.keys(customAttrs).length > 0 ? JSON.stringify(customAttrs) : null,
            validationStatus: validation.status,
            source: "import",
          },
        });
        contactId = created.id;
        importedCount++;
      }

      // Add to list if specified
      if (listId && contactId) {
        try {
          await prisma.contactListMember.upsert({
            where: { contactId_listId: { contactId, listId } },
            create: { contactId, listId },
            update: {},
          });
        } catch {
          // Ignore list join error
        }
      }
    }

    // Insert any collected row errors
    if (errorsToInsert.length > 0) {
      await prisma.importError.createMany({
        data: errorsToInsert,
      });
    }

    // Update import job summary
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        importedRows: importedCount,
        failedRows: failedCount,
        duplicateCount,
        status: "completed",
      },
    });

    // Update list count if applicable
    if (listId) {
      const listCount = await prisma.contactListMember.count({ where: { listId } });
      await prisma.contactList.update({
        where: { id: listId },
        data: { contactCount: listCount },
      });
    }

    return NextResponse.json({
      success: true,
      importJobId: importJob.id,
      summary: {
        totalRows: records.length,
        importedRows: importedCount,
        failedRows: failedCount,
        duplicateCount,
      },
      errors: errorsToInsert.slice(0, 50),
    });
  } catch (error: unknown) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Failed to process import file" }, { status: 500 });
  }
}
