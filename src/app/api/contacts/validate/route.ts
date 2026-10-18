import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateEmail } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const { email, contactIds, validateAll = false } = await req.json();

    // Single email validation
    if (email) {
      const result = await validateEmail(email, { checkDns: true, useCache: false });
      return NextResponse.json({ success: true, result });
    }

    // Batch validation
    const whereClause: Record<string, unknown> = {};
    if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
      whereClause.id = { in: contactIds };
    } else if (!validateAll) {
      whereClause.validationStatus = "unknown";
    }

    const contacts = await prisma.contact.findMany({
      where: whereClause,
      take: 50, // Process up to 50 at a time to prevent timeout
      select: { id: true, normalizedEmail: true },
    });

    const results = [];
    for (const c of contacts) {
      const val = await validateEmail(c.normalizedEmail, { checkDns: true, useCache: true });
      await prisma.contact.update({
        where: { id: c.id },
        data: { validationStatus: val.status },
      });
      results.push({
        id: c.id,
        email: c.normalizedEmail,
        status: val.status,
        details: val.details,
      });
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: unknown) {
    console.error("Validation error:", error);
    return NextResponse.json({ error: "Failed to perform email validation" }, { status: 500 });
  }
}
