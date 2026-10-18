import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeEmail, validateEmail } from "@/lib/validation";

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
    const id = url.searchParams.get("id");
    const ids = url.searchParams.get("ids")?.split(",");

    if (id) {
      await prisma.contact.delete({ where: { id } });
      return NextResponse.json({ success: true, deleted: 1 });
    }

    if (ids && ids.length > 0) {
      const res = await prisma.contact.deleteMany({
        where: { id: { in: ids } },
      });
      return NextResponse.json({ success: true, deleted: res.count });
    }

    return NextResponse.json({ error: "Missing contact ID or IDs" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Contact DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete contact(s)" }, { status: 500 });
  }
}
