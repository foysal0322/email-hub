import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import Papa from "papaparse";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const listId = url.searchParams.get("listId");
    const status = url.searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (listId) {
      where.listMemberships = { some: { listId } };
    }
    if (status) {
      where.status = status;
    }

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const rows = contacts.map((c) => {
      let custom: Record<string, unknown> = {};
      if (c.customAttributes) {
        try {
          custom = JSON.parse(c.customAttributes);
        } catch {}
      }

      return {
        email: c.email,
        name: c.fullName || "",
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        department: c.department || "",
        organization: c.organization || "",
        jobTitle: c.jobTitle || "",
        phone: c.phone || "",
        status: c.status,
        validationStatus: c.validationStatus,
        bounceCount: c.bounceCount,
        ...custom,
      };
    });

    const csv = Papa.unparse(rows);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contacts_export_${Date.now()}.csv"`,
      },
    });
  } catch (error: unknown) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to export contacts" }, { status: 500 });
  }
}
