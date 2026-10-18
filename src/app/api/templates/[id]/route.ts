import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: params.id },
    });
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    return NextResponse.json({ template });
  } catch (error: unknown) {
    console.error("Template GET error:", error);
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const data = await req.json();
    const template = await prisma.emailTemplate.update({
      where: { id: params.id },
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        subject: data.subject,
        preheader: data.preheader,
        htmlContent: data.htmlContent,
        plainTextContent: data.plainTextContent,
      },
    });
    return NextResponse.json({ success: true, template });
  } catch (error: unknown) {
    console.error("Template PUT error:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.emailTemplate.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Template DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
