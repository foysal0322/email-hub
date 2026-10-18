import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ templates });
  } catch (error: unknown) {
    console.error("Templates GET error:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { name, description, category, subject, preheader, htmlContent, plainTextContent } = data;

    if (!name || !htmlContent) {
      return NextResponse.json({ error: "Template name and HTML content are required" }, { status: 400 });
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        category: category || "general",
        subject: subject?.trim() || null,
        preheader: preheader?.trim() || null,
        htmlContent,
        plainTextContent: plainTextContent || null,
      },
    });

    return NextResponse.json({ success: true, template });
  } catch (error: unknown) {
    console.error("Template POST error:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
