import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeEmail, validateEmail } from "@/lib/validation";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const department = url.searchParams.get("department") || "";
    const listId = url.searchParams.get("listId") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { fullName: { contains: search } },
        { organization: { contains: search } },
        { department: { contains: search } },
        { customAttributes: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (department) {
      where.department = department;
    }

    if (listId) {
      where.listMemberships = {
        some: { listId },
      };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          listMemberships: {
            include: { list: { select: { id: true, name: true } } },
          },
          tags: {
            include: { tag: { select: { id: true, name: true, color: true } } },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error("Contacts GET error:", error);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const rawEmail = data.email;
    const normalized = normalizeEmail(rawEmail);

    if (!normalized) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }

    // Check if email is already registered
    const existing = await prisma.contact.findUnique({
      where: { normalizedEmail: normalized },
    });

    if (existing) {
      return NextResponse.json({ error: "A contact with this email already exists" }, { status: 409 });
    }

    // Validate email format and DNS
    const validation = await validateEmail(normalized);

    const contact = await prisma.contact.create({
      data: {
        email: rawEmail.trim(),
        normalizedEmail: normalized,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        fullName: data.fullName || (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : data.name || null),
        department: data.department || data.dept_name || null,
        organization: data.organization || data.company || null,
        jobTitle: data.jobTitle || data.designation || null,
        phone: data.phone || null,
        customAttributes: data.customAttributes ? (typeof data.customAttributes === "string" ? data.customAttributes : JSON.stringify(data.customAttributes)) : null,
        status: data.status || "subscribed",
        validationStatus: validation.status,
        source: data.source || "manual",
      },
    });

    return NextResponse.json({ success: true, contact });
  } catch (error: unknown) {
    console.error("Contact POST error:", error);
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    let targetIds: string[] = [];
    let purgeSuppression = true;
    let reason = "Admin permanent deletion";

    // 1. Check query parameters
    const paramId = url.searchParams.get("id");
    const paramIds = url.searchParams.get("ids")?.split(",").map((s) => s.trim()).filter(Boolean);
    if (paramId) targetIds.push(paramId);
    if (paramIds && paramIds.length > 0) targetIds.push(...paramIds);

    if (url.searchParams.has("purgeSuppression")) {
      purgeSuppression = url.searchParams.get("purgeSuppression") === "true";
    }
    if (url.searchParams.get("reason")) {
      reason = url.searchParams.get("reason")!;
    }

    // 2. Check JSON payload if provided
    if (req.headers.get("content-type")?.includes("application/json")) {
      try {
        const body = await req.json();
        if (body.id) targetIds.push(body.id);
        if (Array.isArray(body.ids)) targetIds.push(...body.ids);
        if (typeof body.purgeSuppression === "boolean") purgeSuppression = body.purgeSuppression;
        if (body.reason) reason = body.reason;
      } catch {
        // Body reading optional
      }
    }

    targetIds = Array.from(new Set(targetIds.filter(Boolean)));

    if (targetIds.length === 0) {
      return NextResponse.json({ error: "Missing contact ID or IDs to delete" }, { status: 400 });
    }

    // 3. Find existing records to obtain metadata and emails
    const existingContacts = await prisma.contact.findMany({
      where: { id: { in: targetIds } },
      select: {
        id: true,
        email: true,
        normalizedEmail: true,
        fullName: true,
        customAttributes: true,
      },
    });

    if (existingContacts.length === 0) {
      return NextResponse.json({ error: "No matching contact(s) found to delete" }, { status: 404 });
    }

    // 4. Identify all affected lists to recalculate member counts later
    const memberships = await prisma.contactListMember.findMany({
      where: { contactId: { in: targetIds } },
      select: { listId: true },
    });
    const affectedListIds = Array.from(new Set(memberships.map((m) => m.listId)));

    // 5. Delete CampaignRecipient records for these contacts
    await prisma.campaignRecipient.deleteMany({
      where: { contactId: { in: targetIds } },
    });

    // 6. Delete ContactListMember and ContactTag associations
    await prisma.contactListMember.deleteMany({
      where: { contactId: { in: targetIds } },
    });
    await prisma.contactTag.deleteMany({
      where: { contactId: { in: targetIds } },
    });

    // 7. Optionally purge matching suppression entries
    const normalizedEmails = existingContacts.map((c) => c.normalizedEmail);
    if (purgeSuppression && normalizedEmails.length > 0) {
      await prisma.suppressionEntry.deleteMany({
        where: { email: { in: normalizedEmails } },
      });
    }

    // 8. Permanently delete the Contact records
    const deleteResult = await prisma.contact.deleteMany({
      where: { id: { in: targetIds } },
    });

    // 9. Synchronize contactCount for all affected lists
    for (const listId of affectedListIds) {
      const actualCount = await prisma.contactListMember.count({
        where: { listId },
      });
      await prisma.contactList.update({
        where: { id: listId },
        data: { contactCount: actualCount },
      });
    }

    // 10. Record administrative AuditLog entries
    const session = await getSession();
    for (const contact of existingContacts) {
      let studentId: string | null = null;
      try {
        if (contact.customAttributes) {
          const parsed = JSON.parse(contact.customAttributes);
          studentId = parsed.id || null;
        }
      } catch {
        studentId = null;
      }

      await prisma.auditLog.create({
        data: {
          userId: session?.id || null,
          action: "permanent_delete_student",
          resourceType: "contact",
          resourceId: contact.id,
          details: JSON.stringify({
            email: contact.email,
            fullName: contact.fullName,
            studentId,
            reason,
            purgedSuppression: !!purgeSuppression,
            deletedBy: session?.email || "admin",
          }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      deleted: deleteResult.count,
      message: `Permanently deleted ${deleteResult.count} student/contact record(s) from the system`,
    });
  } catch (error: unknown) {
    console.error("Permanent delete contact error:", error);
    return NextResponse.json({ error: "Failed to permanently delete student/contact" }, { status: 500 });
  }
}
